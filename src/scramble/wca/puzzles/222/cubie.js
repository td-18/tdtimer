// 2x2 块级模型与规范坐标（M1）
//
// 8 个角块沿用 Kociemba 的编号：
//   URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
// 2x2 没有固定中心，整体旋转等价。这里把 URF（角块 0）规范到 0 号槽位、
// 朝向 0，得到 7! * 3^6 = 3,674,160 个规范状态。
//
// 规范状态编码：
//   permIndex(0..5039)：其余 7 个角块在 1..7 号槽位的排列
//   oriIndex(0..728) ：其余 7 个角块的朝向，前 6 个自由，第 7 个由朝向和约束决定
//   state = permIndex * 729 + oriIndex

import { rankPerm, unrankPerm } from "../lib/perm.js";

export const CORNER_NAMES = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
export const FACE_NAMES = ["U", "R", "F", "D", "L", "B"];

export const CANONICAL_STATE_COUNT = 3674160;

const SOLVED_CUBE = Object.freeze({
    cp: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]),
    co: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
});

const BASE_MOVES = Object.freeze({
    U: Object.freeze({
        cp: Object.freeze([3, 0, 1, 2, 4, 5, 6, 7]),
        co: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    }),
    R: Object.freeze({
        cp: Object.freeze([4, 1, 2, 0, 7, 5, 6, 3]),
        co: Object.freeze([2, 0, 0, 1, 1, 0, 0, 2]),
    }),
    F: Object.freeze({
        cp: Object.freeze([1, 5, 2, 3, 0, 4, 6, 7]),
        co: Object.freeze([1, 2, 0, 0, 2, 1, 0, 0]),
    }),
    D: Object.freeze({
        cp: Object.freeze([0, 1, 2, 3, 5, 6, 7, 4]),
        co: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    }),
    L: Object.freeze({
        cp: Object.freeze([0, 2, 6, 3, 4, 1, 5, 7]),
        co: Object.freeze([0, 1, 2, 0, 0, 2, 1, 0]),
    }),
    B: Object.freeze({
        cp: Object.freeze([0, 1, 3, 7, 4, 5, 2, 6]),
        co: Object.freeze([0, 0, 1, 2, 0, 0, 2, 1]),
    }),
});

// 三个基础整体旋转（只关心角块，等价于 Kociemba rotCube 的 u4 / f2 / urf）。
const BASE_ROTATIONS = Object.freeze([
    Object.freeze({
        cp: Object.freeze([3, 0, 1, 2, 7, 4, 5, 6]),
        co: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    }),
    Object.freeze({
        cp: Object.freeze([5, 4, 7, 6, 1, 0, 3, 2]),
        co: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    }),
    Object.freeze({
        cp: Object.freeze([0, 4, 5, 1, 3, 7, 6, 2]),
        co: Object.freeze([1, 2, 1, 2, 2, 1, 2, 1]),
    }),
]);

function stateKey(state) {
    return `${state.cp.join(",")}|${state.co.join(",")}`;
}

export function composeCorners(a, b) {
    const cp = new Array(8);
    const co = new Array(8);
    for (let i = 0; i < 8; i++) {
        const corner = b.cp[i];
        cp[i] = a.cp[corner];
        co[i] = (a.co[corner] + b.co[i]) % 3;
    }
    return { cp, co };
}

function powerState(state, power) {
    let result = SOLVED_CUBE;
    for (let i = 0; i < power; i++) result = composeCorners(result, state);
    return result;
}

export function solvedCube() {
    return { cp: SOLVED_CUBE.cp.slice(), co: SOLVED_CUBE.co.slice() };
}

export function applyMove(state, move) {
    // composeCorners(state, move) 的语义是“把 move 作用到 state 上”。
    return composeCorners(state, move.state);
}

export function applyMoves(state, moves) {
    let result = state;
    for (const move of moves) result = applyMove(result, move);
    return result;
}

export function isSolvedCube(state) {
    for (let i = 0; i < 8; i++) {
        if (state.cp[i] !== i || state.co[i] !== 0) return false;
    }
    return true;
}

function buildRotations() {
    const list = [];
    const seen = new Set();

    const add = (state) => {
        const key = stateKey(state);
        if (seen.has(key)) return;
        seen.add(key);
        list.push(state);
    };

    add(SOLVED_CUBE);
    for (let i = 0; i < list.length; i++) {
        for (const rotation of BASE_ROTATIONS) {
            add(composeCorners(rotation, list[i]));
        }
    }
    return list;
}

const ROTATIONS = Object.freeze(buildRotations());

if (ROTATIONS.length !== 24) {
    throw new Error(`2x2 整体旋转数量异常: ${ROTATIONS.length}`);
}

export function normalizeCube(state) {
    const position = state.cp.indexOf(0);
    const orientation = state.co[position];
    const wanted = (3 - (orientation % 3)) % 3;

    for (const rotation of ROTATIONS) {
        // 把 rotation 作用到 state 后，角块 0 必须落在 0 号槽位且朝向为 0。
        if (rotation.cp[0] === position && rotation.co[0] === wanted) {
            return composeCorners(state, rotation);
        }
    }
    throw new Error("2x2 规范状态归一化失败");
}

function buildMoveVariants() {
    const variants = [];
    for (const face of FACE_NAMES) {
        const base = BASE_MOVES[face];
        for (let power = 1; power <= 3; power++) {
            const state = powerState(base, power);
            const token = power === 1 ? face : power === 2 ? `${face}2` : `${face}'`;
            variants.push({
                face,
                power,
                token,
                state,
                index: variants.length,
            });
        }
    }
    return variants;
}

export const MOVE_VARIANTS = Object.freeze(buildMoveVariants());

const MOVE_BY_FACE_POWER = new Map();
for (const move of MOVE_VARIANTS) {
    MOVE_BY_FACE_POWER.set(`${move.face}:${move.power}`, move);
}

// 规范坐标下的 18 个动作。slotMap[源槽位] = 目标槽位，
// oriDelta[源槽位] = 目标朝向增量。
function buildCanonicalMoves() {
    const moves = [];
    for (const variant of MOVE_VARIANTS) {
        const moved = normalizeCube(composeCorners(variant.state, SOLVED_CUBE));
        const slotMap = new Array(8);
        const oriDelta = new Array(8);

        for (let originalSlot = 0; originalSlot < 8; originalSlot++) {
            const corner = originalSlot;
            const targetSlot = moved.cp.indexOf(corner);
            slotMap[originalSlot] = targetSlot;
            oriDelta[originalSlot] = moved.co[targetSlot];
        }

        if (slotMap[0] !== 0 || oriDelta[0] !== 0) {
            throw new Error(`2x2 动作 ${variant.token} 没有保持 URF 规范`);
        }

        moves.push({
            ...variant,
            slotMap,
            oriDelta,
        });
    }
    return moves;
}

export const CANONICAL_MOVES = Object.freeze(buildCanonicalMoves());

// 2x2 没有固定中心，U 与 D'、R 与 L'、F 与 B' 在规范坐标下是同一个变换。
// BFS 只需要 9 个不同的变换；生成打乱时可以在等价动作里随机选一个 token，
// 这样距离仍然是最优物理步数，同时保留六面记法的观感。
function buildCanonicalTransforms() {
    const groups = new Map();
    for (const move of CANONICAL_MOVES) {
        const key = `${move.slotMap.join(",")}|${move.oriDelta.join(",")}`;
        if (!groups.has(key)) {
            groups.set(key, {
                index: groups.size,
                slotMap: move.slotMap,
                oriDelta: move.oriDelta,
                variants: [],
            });
        }
        const group = groups.get(key);
        group.variants.push(move);
        move.transformIndex = group.index;
    }
    return [...groups.values()];
}

export const CANONICAL_TRANSFORMS = Object.freeze(buildCanonicalTransforms());
if (CANONICAL_TRANSFORMS.length !== 9) {
    throw new Error(`2x2 规范变换数量异常: ${CANONICAL_TRANSFORMS.length}`);
}

const CANONICAL_MOVE_BY_FACE_POWER = new Map();
for (const move of CANONICAL_MOVES) {
    CANONICAL_MOVE_BY_FACE_POWER.set(`${move.face}:${move.power}`, move);
}

export function getCanonicalMove(face, power) {
    return CANONICAL_MOVE_BY_FACE_POWER.get(`${face}:${power}`) || null;
}

export function invertCanonicalMove(move) {
    return CANONICAL_MOVE_BY_FACE_POWER.get(`${move.face}:${4 - move.power}`) || null;
}

// ---- 规范状态编解码 ----

const PERM_POS = new Array(5040);
for (let index = 0; index < 5040; index++) {
    PERM_POS[index] = unrankPerm(index, 7).map((value) => value + 1);
}

const ORI_DIGITS = new Array(729);
for (let index = 0; index < 729; index++) {
    const digits = new Array(7);
    let rest = index;
    let sum = 0;
    for (let i = 5; i >= 0; i--) {
        const digit = rest % 3;
        digits[i] = digit;
        sum += digit;
        rest = Math.floor(rest / 3);
    }
    digits[6] = (3 - (sum % 3)) % 3;
    ORI_DIGITS[index] = digits;
}

export function permIndexToPositions(permIndex) {
    return PERM_POS[permIndex].slice();
}

export function oriIndexToDigits(oriIndex) {
    return ORI_DIGITS[oriIndex].slice();
}

export function encodeCube(state) {
    const normalized = normalizeCube(state);
    const positions = new Array(7);
    const orientations = new Array(7);

    for (let corner = 1; corner < 8; corner++) {
        const slot = normalized.cp.indexOf(corner);
        positions[corner - 1] = slot - 1;
        orientations[corner - 1] = normalized.co[slot];
    }

    const orientationSum = orientations.reduce((sum, value) => sum + value, 0);
    if (orientationSum % 3 !== 0) {
        throw new Error("2x2 朝向和不为 0");
    }

    let oriIndex = 0;
    for (let i = 0; i < 6; i++) oriIndex = oriIndex * 3 + orientations[i];

    return rankPerm(positions) * 729 + oriIndex;
}

export function decodeCube(index) {
    if (!Number.isInteger(index) || index < 0 || index >= CANONICAL_STATE_COUNT) {
        throw new RangeError(`2x2 状态索引越界: ${index}`);
    }
    const permIndex = Math.floor(index / 729);
    const oriIndex = index % 729;
    const positions = PERM_POS[permIndex];
    const orientations = ORI_DIGITS[oriIndex];

    const cp = new Array(8);
    const co = new Array(8);
    cp[0] = 0;
    co[0] = 0;
    for (let i = 0; i < 7; i++) {
        const slot = positions[i];
        cp[slot] = i + 1;
        co[slot] = orientations[i];
    }
    return { cp, co };
}

// 规范状态上应用一个动作。tables.js 的 BFS 会用它建距离表。
export function applyCanonicalMove(index, move) {
    const permIndex = Math.floor(index / 729);
    const oriIndex = index % 729;
    const positions = PERM_POS[permIndex];
    const orientations = ORI_DIGITS[oriIndex];

    const nextPositions = new Array(7);
    const nextOrientations = new Array(7);

    for (let i = 0; i < 7; i++) {
        const sourceSlot = positions[i];
        nextPositions[i] = move.slotMap[sourceSlot] - 1;
        nextOrientations[i] = (orientations[i] + move.oriDelta[sourceSlot]) % 3;
    }

    let nextOriIndex = 0;
    for (let i = 0; i < 6; i++) nextOriIndex = nextOriIndex * 3 + nextOrientations[i];

    return rankPerm(nextPositions) * 729 + nextOriIndex;
}

export function randomCube(randomInt) {
    if (typeof randomInt !== "function") {
        throw new TypeError("randomCube 需要 randomInt(maxExclusive)");
    }

    // 均匀取一个规范状态，再解码回块级模型。
    return decodeCube(randomInt(CANONICAL_STATE_COUNT));
}

export function movesToString(moves) {
    return moves.map((move) => move.token).join(" ");
}

export function stringToMoves(alg) {
    return String(alg ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
            const match = /^([URFDLB])(2|')?$/.exec(token);
            if (!match) throw new Error(`2x2 无法解析动作: ${token}`);
            const power = match[2] === "2" ? 2 : match[2] === "'" ? 3 : 1;
            return getCanonicalMove(match[1], power);
        });
}

export function invertMoves(moves) {
    return moves
        .slice()
        .reverse()
        .map((move) => invertCanonicalMove(move));
}

// 只合并相邻同面动作；最短路径本身不会产生相邻同面，但保留给外部校验用。
export function simplifyMoves(moves) {
    const output = [];
    for (const move of moves) {
        const last = output[output.length - 1];
        if (last && last.face === move.face) {
            const power = (last.power + move.power) % 4;
            output.pop();
            if (power !== 0) {
                output.push(getCanonicalMove(move.face, power));
            }
        } else {
            output.push(move);
        }
    }
    return output;
}
