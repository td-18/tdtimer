// Pyraminx 全状态距离表（M1）
//
// 状态空间只有 1,866,240，直接 BFS 得到最优距离。
// 生成时随机取状态，按距离下降求最短解，再取逆。

import {
    MOVE_VARIANTS,
    MOVE_TABLE_STRIDE,
    STATE_COUNT,
    nextStateFromTables,
} from "./cubie.js";

function buildDistanceTable() {
    const distance = new Int8Array(STATE_COUNT);
    distance.fill(-1);
    const queue = new Int32Array(STATE_COUNT);

    distance[0] = 0;
    queue[0] = 0;
    let head = 0;
    let tail = 1;
    let maxDepth = 0;

    while (head < tail) {
        const state = queue[head++];
        const depth = distance[state];
        if (depth > maxDepth) maxDepth = depth;

        for (let moveIndex = 0; moveIndex < MOVE_TABLE_STRIDE; moveIndex++) {
            const next = nextStateFromTables(state, moveIndex);
            if (distance[next] === -1) {
                distance[next] = depth + 1;
                queue[tail++] = next;
            }
        }
    }

    return { distance, visited: tail, maxDepth };
}

let cachedTables = null;
let buildingPromise = null;

export function getTables(onProgress) {
    if (cachedTables) {
        if (typeof onProgress === "function") onProgress({ phase: "init", percent: 100, cached: true });
        return Promise.resolve(cachedTables);
    }
    if (buildingPromise) return buildingPromise;

    buildingPromise = Promise.resolve().then(() => {
        const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (typeof onProgress === "function") onProgress({ phase: "init", percent: 5 });

        const { distance, visited, maxDepth } = buildDistanceTable();

        const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (typeof onProgress === "function") onProgress({ phase: "init", percent: 100 });

        // Pyraminx 的索引空间是 1,866,240，但只有一半状态可达
        // （棱块朝向与角尖/排列之间存在半群约束）。这里保留完整索引，
        // 生成时用 distance >= 0 过滤不可达状态，得到可达状态上的均匀分布。
        cachedTables = {
            size: STATE_COUNT,
            reachable: visited,
            distance,
            maxDepth,
            buildMs: finishedAt - startedAt,
            moveCount: MOVE_TABLE_STRIDE,
            nextState: nextStateFromTables,
            solve(index, randomInt) {
                if (!Number.isInteger(index) || index < 0 || index >= STATE_COUNT) {
                    throw new RangeError(`Pyraminx 状态索引越界: ${index}`);
                }
                if (distance[index] < 0) {
                    throw new Error(`Pyraminx 状态不可达: ${index}`);
                }

                const path = [];
                let state = index;
                let guard = 0;
                while (state !== 0) {
                    const depth = distance[state];
                    const candidates = [];
                    for (let moveIndex = 0; moveIndex < MOVE_TABLE_STRIDE; moveIndex++) {
                        const next = nextStateFromTables(state, moveIndex);
                        if (distance[next] === depth - 1) candidates.push(moveIndex);
                    }
                    if (!candidates.length) {
                        throw new Error(`Pyraminx 状态 ${state} 找不到最短下降路径`);
                    }
                    const pick = candidates[randomInt(candidates.length)];
                    path.push(MOVE_VARIANTS[pick]);
                    state = nextStateFromTables(state, pick);
                    if (++guard > 64) throw new Error("Pyraminx 求解循环过长");
                }
                return path;
            },
        };
        return cachedTables;
    }).finally(() => {
        buildingPromise = null;
    });

    return buildingPromise;
}

export function clearTablesCache() {
    cachedTables = null;
    buildingPromise = null;
}
