// 5x5 / 6x6 / 7x7 随机转动生成器（M3）
//
// WCA 4b3e 允许大魔方使用足够多的随机转动，而不是随机状态。
// 这里按 TNoodle 常见规模生成 60 / 80 / 100 步，并过滤连续同轴动作。
//
// 记法：
//   外层：R U F D L B
//   两层宽：Rw Uw ...
//   三层宽：3Rw 3Uw ...
// 5x5 最多两层宽；6x6/7x7 最多三层宽。

export const BIG_CUBE_FACES = Object.freeze(["U", "R", "F", "D", "L", "B"]);
const FACE_AXIS = Object.freeze([0, 1, 2, 0, 1, 2]);

export const BIG_CUBE_CONFIG = Object.freeze({
    "555": Object.freeze({ size: 5, moves: 60, maxLayers: 2 }),
    "666": Object.freeze({ size: 6, moves: 80, maxLayers: 3 }),
    "777": Object.freeze({ size: 7, moves: 100, maxLayers: 3 }),
});

function formatMove(face, layer, power) {
    const base = layer === 1 ? face : layer === 2 ? `${face}w` : `${layer}${face}w`;
    const suffix = power === 2 ? "2" : power === 3 ? "'" : "";
    return `${base}${suffix}`;
}

export function generateBigCubeScramble({ size: _size, moves, maxLayers }, randomInt) {
    if (typeof randomInt !== "function") throw new TypeError("randomInt 必须是函数");
    if (!Number.isInteger(moves) || moves < 2) {
        throw new RangeError("moves 必须是 >=2 的整数");
    }
    if (!Number.isInteger(maxLayers) || maxLayers < 1) {
        throw new RangeError("maxLayers 必须是正整数");
    }

    const tokens = [];
    let previousAxis = -1;

    while (tokens.length < moves) {
        let faceIndex = randomInt(BIG_CUBE_FACES.length);
        // 避免连续同轴动作（例如 R 后接 L），减少冗余。
        while (FACE_AXIS[faceIndex] === previousAxis) {
            faceIndex = randomInt(BIG_CUBE_FACES.length);
        }

        const face = BIG_CUBE_FACES[faceIndex];
        const layer = 1 + randomInt(maxLayers);
        const power = 1 + randomInt(3);
        tokens.push(formatMove(face, layer, power));

        previousAxis = FACE_AXIS[faceIndex];
    }

    return tokens.join(" ");
}

export function getBigCubeConfig(eventId) {
    return BIG_CUBE_CONFIG[eventId] || null;
}
