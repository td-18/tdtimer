// Pyraminx 块级模型（M1）
//
// 6 个棱块 + 4 个角尖。动作定义与 csTimer 的 Pyraminx 模型一致：
//   U/L/R/B 为四个面转，每个面转循环 3 个棱块、翻转 2 个槽位、并拧动 1 个角尖；
//   u/l/r/b 为四个角尖的独立转动。
//
// 状态：
//   ep[6] 槽位 -> 棱块编号
//   eo[6] 每个槽位的棱块朝向，偶校验（32 种）
//   co[4] 角尖扭转，mod 3（81 种）
// 总状态数 720 * 32 * 81 = 1,866,240。

import { rankPerm, unrankPerm } from "../lib/perm.js";

export const EDGE_NAMES = ["UF", "UL", "UR", "DF", "DR", "DB"];
export const FACE_NAMES = ["U", "L", "R", "B"];
export const TIP_NAMES = ["u", "l", "r", "b"];

export const STATE_COUNT = 1866240;
export const MIN_DISTANCE = 6;

const SOLVED = Object.freeze({
    ep: Object.freeze([0, 1, 2, 3, 4, 5]),
    eo: Object.freeze([0, 0, 0, 0, 0, 0]),
    co: Object.freeze([0, 0, 0, 0]),
});

// cycle 的语义与 cstimer acycle 一致：
//   new[cycle[1]] = old[cycle[0]], new[cycle[2]] = old[cycle[1]], new[cycle[0]] = old[cycle[2]]
const FACE_MOVES = Object.freeze([
    Object.freeze({ face: "U", cycle: Object.freeze([0, 1, 3]), flips: Object.freeze([1, 3]), tip: 0 }),
    Object.freeze({ face: "L", cycle: Object.freeze([1, 2, 5]), flips: Object.freeze([2, 5]), tip: 1 }),
    Object.freeze({ face: "R", cycle: Object.freeze([0, 4, 2]), flips: Object.freeze([2, 0]), tip: 2 }),
    Object.freeze({ face: "B", cycle: Object.freeze([3, 5, 4]), flips: Object.freeze([5, 3]), tip: 3 }),
]);

function cycle3(arr, cycle) {
    const [a, b, c] = cycle;
    const tmp = arr[a];
    arr[a] = arr[c];
    arr[c] = arr[b];
    arr[b] = tmp;
}

function cloneState(state) {
    return {
        ep: state.ep.slice(),
        eo: state.eo.slice(),
        co: state.co.slice(),
    };
}

export function solvedState() {
    return cloneState(SOLVED);
}

export function isSolvedState(state) {
    for (let i = 0; i < 6; i++) {
        if (state.ep[i] !== i || state.eo[i] !== 0) return false;
    }
    for (let i = 0; i < 4; i++) {
        if (state.co[i] !== 0) return false;
    }
    return true;
}

function applyBaseFaceMove(state, faceMove) {
    cycle3(state.ep, faceMove.cycle);
    cycle3(state.eo, faceMove.cycle);
    for (const slot of faceMove.flips) state.eo[slot] ^= 1;
    state.co[faceMove.tip] = (state.co[faceMove.tip] + 1) % 3;
}

function applyBaseTipMove(state, tipIndex) {
    state.co[tipIndex] = (state.co[tipIndex] + 1) % 3;
}

function buildMoveVariants() {
    const variants = [];

    for (let faceIndex = 0; faceIndex < FACE_MOVES.length; faceIndex++) {
        const faceMove = FACE_MOVES[faceIndex];
        for (let power = 1; power <= 2; power++) {
            const state = solvedState();
            for (let i = 0; i < power; i++) applyBaseFaceMove(state, faceMove);
            variants.push({
                kind: "face",
                axis: faceIndex,
                face: faceMove.face,
                power,
                token: power === 1 ? faceMove.face : `${faceMove.face}'`,
                state,
                index: variants.length,
            });
        }
    }

    for (let tipIndex = 0; tipIndex < TIP_NAMES.length; tipIndex++) {
        for (let power = 1; power <= 2; power++) {
            const state = solvedState();
            for (let i = 0; i < power; i++) applyBaseTipMove(state, tipIndex);
            variants.push({
                kind: "tip",
                axis: tipIndex,
                face: TIP_NAMES[tipIndex],
                power,
                token: power === 1 ? TIP_NAMES[tipIndex] : `${TIP_NAMES[tipIndex]}'`,
                state,
                index: variants.length,
            });
        }
    }

    return variants;
}

export const MOVE_VARIANTS = Object.freeze(buildMoveVariants());

const VARIANT_BY_KEY = new Map();
for (const move of MOVE_VARIANTS) {
    VARIANT_BY_KEY.set(`${move.kind}:${move.axis}:${move.power}`, move);
}

export function getMove(kind, axis, power) {
    return VARIANT_BY_KEY.get(`${kind}:${axis}:${power}`) || null;
}

export function invertMove(move) {
    return VARIANT_BY_KEY.get(`${move.kind}:${move.axis}:${3 - move.power}`) || null;
}

export function applyMove(state, move) {
    const next = cloneState(state);
    if (move.kind === "face") {
        for (let i = 0; i < move.power; i++) applyBaseFaceMove(next, FACE_MOVES[move.axis]);
    } else {
        for (let i = 0; i < move.power; i++) applyBaseTipMove(next, move.axis);
    }
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
            const match = /^([ULRBulrb])(')?$/.exec(token);
            if (!match) throw new Error(`Pyraminx 无法解析动作: ${token}`);
            const letter = match[1];
            const kind = letter === letter.toUpperCase() ? "face" : "tip";
            const axis = kind === "face" ? FACE_NAMES.indexOf(letter) : TIP_NAMES.indexOf(letter);
            if (axis < 0) throw new Error(`Pyraminx 未知动作: ${token}`);
            return getMove(kind, axis, match[2] ? 2 : 1);
        });
}

export function invertMoves(moves) {
    return moves
        .slice()
        .reverse()
        .map((move) => invertMove(move));
}

// ---- 状态编码 ----

const EP_PERM_COUNT = 720;
const EO_COUNT = 32;
const CO_COUNT = 81;

const EP_PERMS = new Array(EP_PERM_COUNT);
for (let index = 0; index < EP_PERM_COUNT; index++) {
    EP_PERMS[index] = unrankPerm(index, 6);
}

const EO_BITS = new Array(EO_COUNT);
for (let index = 0; index < EO_COUNT; index++) {
    const bits = new Array(6);
    let rest = index;
    let parity = 0;
    for (let i = 0; i < 5; i++) {
        bits[i] = rest & 1;
        parity ^= bits[i];
        rest >>= 1;
    }
    bits[5] = parity;
    EO_BITS[index] = bits;
}

const CO_DIGITS = new Array(CO_COUNT);
for (let index = 0; index < CO_COUNT; index++) {
    const digits = new Array(4);
    let rest = index;
    for (let i = 0; i < 4; i++) {
        digits[i] = rest % 3;
        rest = Math.floor(rest / 3);
    }
    CO_DIGITS[index] = digits;
}

export function encodeState(state) {
    let epIndex;
    // 直接用块编号数组求 rank；状态本身很小，没必要走查表。
    epIndex = rankPerm(state.ep);

    let eoIndex = 0;
    for (let i = 0; i < 5; i++) eoIndex |= state.eo[i] << i;

    let coIndex = 0;
    for (let i = 3; i >= 0; i--) coIndex = coIndex * 3 + state.co[i];

    return (epIndex * EO_COUNT + eoIndex) * CO_COUNT + coIndex;
}

export function decodeState(index) {
    if (!Number.isInteger(index) || index < 0 || index >= STATE_COUNT) {
        throw new RangeError(`Pyraminx 状态索引越界: ${index}`);
    }
    const coIndex = index % CO_COUNT;
    const rest = Math.floor(index / CO_COUNT);
    const eoIndex = rest % EO_COUNT;
    const epIndex = Math.floor(rest / EO_COUNT);

    return {
        ep: EP_PERMS[epIndex].slice(),
        eo: EO_BITS[eoIndex].slice(),
        co: CO_DIGITS[coIndex].slice(),
    };
}

export function permPositionTable() {
    return EP_PERMS;
}

export function orientationBitTable() {
    return EO_BITS;
}

export function tipDigitTable() {
    return CO_DIGITS;
}

export function buildMoveTables() {
    const epMove = new Uint16Array(EP_PERM_COUNT * MOVE_VARIANTS.length);
    const eoMove = new Uint8Array(EO_COUNT * MOVE_VARIANTS.length);
    const coMove = new Uint8Array(CO_COUNT * MOVE_VARIANTS.length);

    for (let moveIndex = 0; moveIndex < MOVE_VARIANTS.length; moveIndex++) {
        const move = MOVE_VARIANTS[moveIndex];

        for (let epIndex = 0; epIndex < EP_PERM_COUNT; epIndex++) {
            const ep = EP_PERMS[epIndex].slice();
            if (move.kind === "face") {
                for (let i = 0; i < move.power; i++) cycle3(ep, FACE_MOVES[move.axis].cycle);
            }
            epMove[epIndex * MOVE_VARIANTS.length + moveIndex] = rankPerm(ep);
        }

        for (let eoIndex = 0; eoIndex < EO_COUNT; eoIndex++) {
            const eo = EO_BITS[eoIndex].slice();
            if (move.kind === "face") {
                for (let i = 0; i < move.power; i++) {
                    cycle3(eo, FACE_MOVES[move.axis].cycle);
                    for (const slot of FACE_MOVES[move.axis].flips) eo[slot] ^= 1;
                }
            }
            let encoded = 0;
            for (let i = 0; i < 5; i++) encoded |= eo[i] << i;
            eoMove[eoIndex * MOVE_VARIANTS.length + moveIndex] = encoded;
        }

        for (let coIndex = 0; coIndex < CO_COUNT; coIndex++) {
            const co = CO_DIGITS[coIndex].slice();
            if (move.kind === "face") {
                const tip = FACE_MOVES[move.axis].tip;
                co[tip] = (co[tip] + move.power) % 3;
            } else {
                co[move.axis] = (co[move.axis] + move.power) % 3;
            }
            let encoded = 0;
            for (let i = 3; i >= 0; i--) encoded = encoded * 3 + co[i];
            coMove[coIndex * MOVE_VARIANTS.length + moveIndex] = encoded;
        }
    }

    return { epMove, eoMove, coMove };
}

const TABLES = buildMoveTables();

export const EP_MOVE = TABLES.epMove;
export const EO_MOVE = TABLES.eoMove;
export const CO_MOVE = TABLES.coMove;
export const MOVE_TABLE_STRIDE = MOVE_VARIANTS.length;

export function nextStateFromTables(index, moveIndex) {
    let rest = index;
    const coIndex = rest % CO_COUNT;
    rest = Math.floor(rest / CO_COUNT);
    const eoIndex = rest % EO_COUNT;
    const epIndex = Math.floor(rest / EO_COUNT);

    const stride = MOVE_TABLE_STRIDE;
    const nextEp = EP_MOVE[epIndex * stride + moveIndex];
    const nextEo = EO_MOVE[eoIndex * stride + moveIndex];
    const nextCo = CO_MOVE[coIndex * stride + moveIndex];
    return (nextEp * EO_COUNT + nextEo) * CO_COUNT + nextCo;
}
