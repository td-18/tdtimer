// Skewb 块级模型（M1）
//
// 采用 csTimer 的 Skewb 坐标：
//   centers[6]      6 个中心块排列（720）
//   corners[4]      4 个可转动角块的偶排列（12）
//   fixed[4]        4 个固定角块的扭转（81）
//   twist[4]        4 个可转动角块的扭转，和约束 mod 3（27）
//
// 索引空间 720 * 12 * 81 * 27 = 9,447,840，其中约 1/3 可达
// （3,149,280 个）。与 Pyraminx 一样，BFS 保留完整索引空间，
// 生成时用 distance >= 0 过滤不可达状态。
//
// 四个动作轴对应 4 个角轴 120° 转；这里命名为 R/U/L/B，四个动作
// 在群论上完全等价，名称不影响随机状态分布。

import { rankPerm, unrankPerm, permutationParity } from "../lib/perm.js";

export const CENTER_COUNT = 360;
export const CORNER_PERM_COUNT = 12;
export const FIXED_ORI_COUNT = 81;
export const TWIST_ORI_COUNT = 27;
export const INDEX_COUNT = CENTER_COUNT * CORNER_PERM_COUNT * FIXED_ORI_COUNT * TWIST_ORI_COUNT;
export const REACHABLE_COUNT = 3149280;
export const MIN_DISTANCE = 7;

export const MOVE_NAMES = ["R", "U", "L", "B"];

const SOLVED = Object.freeze({
    centers: Object.freeze([0, 1, 2, 3, 4, 5]),
    corners: Object.freeze([0, 1, 2, 3]),
    fixed: Object.freeze([0, 0, 0, 0]),
    twist: Object.freeze([0, 0, 0, 0]),
});

const MOVE_CENTERS = Object.freeze([
    Object.freeze([0, 3, 1]),
    Object.freeze([0, 2, 4]),
    Object.freeze([1, 5, 2]),
    Object.freeze([3, 4, 5]),
]);

const MOVE_CORNERS = Object.freeze([
    Object.freeze([0, 1, 2]),
    Object.freeze([0, 3, 1]),
    Object.freeze([0, 2, 3]),
    Object.freeze([1, 3, 2]),
]);

const MOVE_COUNT = 8;

function cycle3(arr, cycle) {
    const [a, b, c] = cycle;
    const tmp = arr[a];
    arr[a] = arr[c];
    arr[c] = arr[b];
    arr[b] = tmp;
}

function cloneState(state) {
    return {
        centers: state.centers.slice(),
        corners: state.corners.slice(),
        fixed: state.fixed.slice(),
        twist: state.twist.slice(),
    };
}

export function solvedState() {
    return cloneState(SOLVED);
}

export function isSolvedState(state) {
    for (let i = 0; i < 6; i++) if (state.centers[i] !== i) return false;
    for (let i = 0; i < 4; i++) {
        if (state.corners[i] !== i) return false;
        if (state.fixed[i] !== 0) return false;
        if (state.twist[i] !== 0) return false;
    }
    return true;
}

function applyBaseMove(state, axis) {
    cycle3(state.centers, MOVE_CENTERS[axis]);
    cycle3(state.corners, MOVE_CORNERS[axis]);

    state.fixed[axis] = (state.fixed[axis] + 1) % 3;

    const cycle = MOVE_CORNERS[axis];
    cycle3(state.twist, cycle);
    for (const slot of cycle) state.twist[slot] = (state.twist[slot] + 2) % 3;
}

function buildMoveVariants() {
    const variants = [];
    for (let axis = 0; axis < MOVE_NAMES.length; axis++) {
        for (let power = 1; power <= 2; power++) {
            const state = solvedState();
            for (let i = 0; i < power; i++) applyBaseMove(state, axis);
            variants.push({
                axis,
                power,
                token: power === 1 ? MOVE_NAMES[axis] : `${MOVE_NAMES[axis]}'`,
                state,
                index: variants.length,
            });
        }
    }
    return variants;
}

export const MOVE_VARIANTS = Object.freeze(buildMoveVariants());

const VARIANT_BY_KEY = new Map();
for (const move of MOVE_VARIANTS) VARIANT_BY_KEY.set(`${move.axis}:${move.power}`, move);

export function getMove(axis, power) {
    return VARIANT_BY_KEY.get(`${axis}:${power}`) || null;
}

export function invertMove(move) {
    return VARIANT_BY_KEY.get(`${move.axis}:${3 - move.power}`) || null;
}

export function applyMove(state, move) {
    const next = cloneState(state);
    for (let i = 0; i < move.power; i++) applyBaseMove(next, move.axis);
    return next;
}

export function applyMoves(state, moves) {
    let result = state;
    for (const move of moves) result = applyMove(result, move);
    return result;
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
            const match = /^([RULB])(')?$/.exec(token);
            if (!match) throw new Error(`Skewb 无法解析动作: ${token}`);
            const axis = MOVE_NAMES.indexOf(match[1]);
            if (axis < 0) throw new Error(`Skewb 未知动作: ${token}`);
            return getMove(axis, match[2] ? 2 : 1);
        });
}

export function invertMoves(moves) {
    return moves
        .slice()
        .reverse()
        .map((move) => invertMove(move));
}

// ---- 坐标表 ----

const CENTER_PERMS = [];
for (let index = 0; index < 720; index++) {
    const perm = unrankPerm(index, 6);
    if (permutationParity(perm) === 0) CENTER_PERMS.push(perm);
}
CENTER_PERMS.sort((a, b) => rankPerm(a) - rankPerm(b));
if (CENTER_PERMS.length !== CENTER_COUNT) {
    throw new Error(`Skewb 中心偶排列数量异常: ${CENTER_PERMS.length}`);
}

const CENTER_PERM_INDEX = new Map();
for (let index = 0; index < CENTER_PERMS.length; index++) {
    CENTER_PERM_INDEX.set(CENTER_PERMS[index].join(","), index);
}

const EVEN_CORNER_PERMS = [];
for (let index = 0; index < 24; index++) {
    const perm = unrankPerm(index, 4);
    if (permutationParity(perm) === 0) EVEN_CORNER_PERMS.push(perm);
}
EVEN_CORNER_PERMS.sort((a, b) => rankPerm(a) - rankPerm(b));
if (EVEN_CORNER_PERMS.length !== CORNER_PERM_COUNT) {
    throw new Error(`Skewb 偶排列数量异常: ${EVEN_CORNER_PERMS.length}`);
}

const CORNER_PERM_INDEX = new Map();
for (let index = 0; index < EVEN_CORNER_PERMS.length; index++) {
    CORNER_PERM_INDEX.set(EVEN_CORNER_PERMS[index].join(","), index);
}

const FIXED_DIGITS = new Array(FIXED_ORI_COUNT);
for (let index = 0; index < FIXED_ORI_COUNT; index++) {
    const digits = new Array(4);
    let rest = index;
    for (let i = 0; i < 4; i++) {
        digits[i] = rest % 3;
        rest = Math.floor(rest / 3);
    }
    FIXED_DIGITS[index] = digits;
}

const TWIST_DIGITS = new Array(TWIST_ORI_COUNT);
for (let index = 0; index < TWIST_ORI_COUNT; index++) {
    const digits = new Array(4);
    let rest = index;
    let sum = 0;
    for (let i = 2; i >= 0; i--) {
        const digit = rest % 3;
        digits[i] = digit;
        sum += digit;
        rest = Math.floor(rest / 3);
    }
    digits[3] = (3 - (sum % 3)) % 3;
    TWIST_DIGITS[index] = digits;
}

export function encodeState(state) {
    const centerIndex = CENTER_PERM_INDEX.get(state.centers.join(","));
    if (centerIndex === undefined) throw new Error("Skewb 中心块排列不是偶排列");
    const cornerIndex = CORNER_PERM_INDEX.get(state.corners.join(","));
    if (cornerIndex === undefined) throw new Error("Skewb 角块排列不是偶排列");

    let fixedIndex = 0;
    for (let i = 3; i >= 0; i--) fixedIndex = fixedIndex * 3 + state.fixed[i];

    let twistIndex = 0;
    for (let i = 0; i < 3; i++) twistIndex = twistIndex * 3 + state.twist[i];

    const permIndex = centerIndex * CORNER_PERM_COUNT + cornerIndex;
    const twstIndex = twistIndex * FIXED_ORI_COUNT + fixedIndex;
    return permIndex * (TWIST_ORI_COUNT * FIXED_ORI_COUNT) + twstIndex;
}

export function decodeState(index) {
    if (!Number.isInteger(index) || index < 0 || index >= INDEX_COUNT) {
        throw new RangeError(`Skewb 状态索引越界: ${index}`);
    }
    const twstIndex = index % (TWIST_ORI_COUNT * FIXED_ORI_COUNT);
    const permIndex = Math.floor(index / (TWIST_ORI_COUNT * FIXED_ORI_COUNT));
    const fixedIndex = twstIndex % FIXED_ORI_COUNT;
    const twistIndex = Math.floor(twstIndex / FIXED_ORI_COUNT);
    const cornerIndex = permIndex % CORNER_PERM_COUNT;
    const centerIndex = Math.floor(permIndex / CORNER_PERM_COUNT);

    return {
        centers: CENTER_PERMS[centerIndex].slice(),
        corners: EVEN_CORNER_PERMS[cornerIndex].slice(),
        fixed: FIXED_DIGITS[fixedIndex].slice(),
        twist: TWIST_DIGITS[twistIndex].slice(),
    };
}

export function centerPermTable() {
    return CENTER_PERMS;
}

export function evenCornerPermTable() {
    return EVEN_CORNER_PERMS;
}

export function fixedDigitTable() {
    return FIXED_DIGITS;
}

export function twistDigitTable() {
    return TWIST_DIGITS;
}

export function buildMoveTables() {
    const centerMove = new Uint16Array(CENTER_COUNT * MOVE_COUNT);
    const cornerMove = new Uint8Array(CORNER_PERM_COUNT * MOVE_COUNT);
    const fixedMove = new Uint8Array(FIXED_ORI_COUNT * MOVE_COUNT);
    const twistMove = new Uint8Array(TWIST_ORI_COUNT * MOVE_COUNT);

    for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
        const axis = moveIndex >> 1;
        const power = (moveIndex & 1) + 1;

        for (let centerIndex = 0; centerIndex < CENTER_COUNT; centerIndex++) {
            const centers = CENTER_PERMS[centerIndex].slice();
            for (let i = 0; i < power; i++) cycle3(centers, MOVE_CENTERS[axis]);
            const nextIndex = CENTER_PERM_INDEX.get(centers.join(","));
            if (nextIndex === undefined) throw new Error("Skewb 动作破坏了中心偶排列约束");
            centerMove[centerIndex * MOVE_COUNT + moveIndex] = nextIndex;
        }

        for (let cornerIndex = 0; cornerIndex < CORNER_PERM_COUNT; cornerIndex++) {
            const corners = EVEN_CORNER_PERMS[cornerIndex].slice();
            for (let i = 0; i < power; i++) cycle3(corners, MOVE_CORNERS[axis]);
            const nextIndex = CORNER_PERM_INDEX.get(corners.join(","));
            if (nextIndex === undefined) throw new Error("Skewb 动作破坏了偶排列约束");
            cornerMove[cornerIndex * MOVE_COUNT + moveIndex] = nextIndex;
        }

        for (let fixedIndex = 0; fixedIndex < FIXED_ORI_COUNT; fixedIndex++) {
            const fixed = FIXED_DIGITS[fixedIndex].slice();
            for (let i = 0; i < power; i++) fixed[axis] = (fixed[axis] + 1) % 3;
            let encoded = 0;
            for (let i = 3; i >= 0; i--) encoded = encoded * 3 + fixed[i];
            fixedMove[fixedIndex * MOVE_COUNT + moveIndex] = encoded;
        }

        for (let twistIndex = 0; twistIndex < TWIST_ORI_COUNT; twistIndex++) {
            const twist = TWIST_DIGITS[twistIndex].slice();
            for (let i = 0; i < power; i++) {
                cycle3(twist, MOVE_CORNERS[axis]);
                for (const slot of MOVE_CORNERS[axis]) twist[slot] = (twist[slot] + 2) % 3;
            }
            let encoded = 0;
            for (let i = 0; i < 3; i++) encoded = encoded * 3 + twist[i];
            twistMove[twistIndex * MOVE_COUNT + moveIndex] = encoded;
        }
    }

    return { centerMove, cornerMove, fixedMove, twistMove };
}

const TABLES = buildMoveTables();
export const CENTER_MOVE = TABLES.centerMove;
export const CORNER_MOVE = TABLES.cornerMove;
export const FIXED_MOVE = TABLES.fixedMove;
export const TWIST_MOVE = TABLES.twistMove;

export function nextStateFromTables(index, moveIndex) {
    const twstIndex = index % (TWIST_ORI_COUNT * FIXED_ORI_COUNT);
    const permIndex = Math.floor(index / (TWIST_ORI_COUNT * FIXED_ORI_COUNT));
    const cornerIndex = permIndex % CORNER_PERM_COUNT;
    const centerIndex = Math.floor(permIndex / CORNER_PERM_COUNT);
    const fixedIndex = twstIndex % FIXED_ORI_COUNT;
    const twistIndex = Math.floor(twstIndex / FIXED_ORI_COUNT);

    const nextCenter = CENTER_MOVE[centerIndex * MOVE_COUNT + moveIndex];
    const nextCorner = CORNER_MOVE[cornerIndex * MOVE_COUNT + moveIndex];
    const nextFixed = FIXED_MOVE[fixedIndex * MOVE_COUNT + moveIndex];
    const nextTwist = TWIST_MOVE[twistIndex * MOVE_COUNT + moveIndex];

    const nextPerm = nextCenter * CORNER_PERM_COUNT + nextCorner;
    const nextTwst = nextTwist * FIXED_ORI_COUNT + nextFixed;
    return nextPerm * (TWIST_ORI_COUNT * FIXED_ORI_COUNT) + nextTwst;
}
