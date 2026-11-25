// 搜索容量规划
//
// 双向 BFS 的规模是“分支数^深度”：加一个面，分支数 +3，
// 同一台浏览器能搜的层数就少一层。这是硬上限，不能靠调参数绕过。
//
// 这里只做两件事：
//   1. 估算某个动作族在某个长度下要多少节点；
//   2. 给出该动作族在当前上限内能搜到的最长长度。
// 生成器据此决定“跳过这一族”还是“降长度”，而不是跑一半再悄悄截断。

// 单侧节点上限。超过这个量，手机浏览器会明显卡顿甚至内存吃紧。
export const NODE_CEILING = 3500000;

// 长度 -> 前向 / 反向深度（前向吃余数）
export function splitLength(length) {
    const backward = Math.floor(length / 2);
    return [length - backward, backward];
}

// 完整层的节点总量（等比求和）：m + m*b + m*b² + …
export function estimateNodes(faces, depth) {
    const moves = faces.length * 3;
    const branch = Math.max(2, moves - 3);
    let total = 0;
    for (let d = 1; d <= depth; d++) total += moves * Math.pow(branch, d - 1);
    return Math.ceil(total);
}

export function planSearch(faces, length, ceiling = NODE_CEILING) {
    const depth = splitLength(length);
    const estimatedNodes = Math.max(
        estimateNodes(faces, depth[0]),
        estimateNodes(faces, depth[1]),
    );
    return {
        faces: [...faces],
        length,
        depth,
        estimatedNodes,
        feasible: estimatedNodes <= ceiling,
        maxLength: maxFeasibleLength(faces, ceiling),
    };
}

export function maxFeasibleLength(faces, ceiling = NODE_CEILING) {
    for (let length = 20; length >= 2; length--) {
        const depth = splitLength(length);
        const estimated = Math.max(
            estimateNodes(faces, depth[0]),
            estimateNodes(faces, depth[1]),
        );
        if (estimated <= ceiling) return length;
    }
    return 2;
}
