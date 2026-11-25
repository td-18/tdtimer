// 公式候选生成用的动作集
//
// 动作编号沿用 cubie.js 的 MOVE_NAMES：每个面 3 个动作（X / X2 / X'）。
// 本模块只做“面名 -> 动作下标”的解析，不产生新的魔方逻辑。

import { MOVE_NAMES, simplifyMoves } from "../scramble/wca/puzzles/333/cubie.js";

// MOVE_NAMES 的面顺序：U R F D L B
export const FACE_ORDER = Object.freeze(["U", "R", "F", "D", "L", "B"]);

// 默认生成集：去掉 B。
// 依据是库里 PLL 的 21 条公式里 B 出现 0 次，先砍掉最贵也最少用的面。
export const DEFAULT_FACES = Object.freeze(["R", "U", "F", "L", "D"]);

export function faceOf(move) {
    return Math.floor(move / 3);
}

// simplifyMoves 是单趟的：`R U U' R2` 会先输出 R，之后 U U' 抵消掉，
// 但已经输出的 R 不会再和新露出来的 R2 合并。这里反复化简到长度不再变化。
export function simplifyToFixed(moves) {
    let current = simplifyMoves(moves);
    for (let i = 0; i < 8; i++) {
        const next = simplifyMoves(current);
        if (next.length === current.length) return next;
        current = next;
    }
    return current;
}

// faces: ["R","U",...]；powers: [0,1,2] 对应 X / X2 / X'
export function resolveMoveSet(faces = DEFAULT_FACES, powers = [0, 1, 2]) {
    const set = [];
    for (const name of faces) {
        const face = FACE_ORDER.indexOf(String(name).toUpperCase());
        if (face < 0) throw new Error(`未知面: ${name}`);
        for (const power of powers) {
            const index = face * 3 + power;
            if (index < 0 || index >= MOVE_NAMES.length) throw new Error(`非法动作下标: ${index}`);
            set.push(index);
        }
    }
    if (!set.length) throw new Error("动作集为空");
    return set;
}
