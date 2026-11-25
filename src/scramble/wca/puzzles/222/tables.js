// 2x2 全状态距离表（M1）
//
// 直接在 3,674,160 个规范状态上做 BFS，得到每个状态的最优步数。
// 生成打乱时随机取状态，按距离逐层下降得到最短解，再取逆。
// 距离表使用 Int8Array，未访问为 -1；BFS 队列使用 Int32Array。

import { rankPerm, unrankPerm } from "../lib/perm.js";
import {
    CANONICAL_STATE_COUNT,
    CANONICAL_TRANSFORMS,
    applyCanonicalMove,
} from "./cubie.js";

const PERM_COUNT = 5040;
const ORI_COUNT = 729;
const MOVE_COUNT = CANONICAL_TRANSFORMS.length;

const PERM_POS = new Array(PERM_COUNT);
for (let index = 0; index < PERM_COUNT; index++) {
    PERM_POS[index] = unrankPerm(index, 7).map((value) => value + 1);
}

const ORI_DIGITS = new Array(ORI_COUNT);
for (let index = 0; index < ORI_COUNT; index++) {
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

const PERM_MOVE = new Uint16Array(PERM_COUNT * MOVE_COUNT);
for (let permIndex = 0; permIndex < PERM_COUNT; permIndex++) {
    const positions = PERM_POS[permIndex];
    for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
        const slotMap = CANONICAL_TRANSFORMS[moveIndex].slotMap;
        const next = new Array(7);
        for (let i = 0; i < 7; i++) next[i] = slotMap[positions[i]] - 1;
        PERM_MOVE[permIndex * MOVE_COUNT + moveIndex] = rankPerm(next);
    }
}

function nextState(state, moveIndex) {
    const permIndex = Math.floor(state / ORI_COUNT);
    const oriIndex = state - permIndex * ORI_COUNT;
    const positions = PERM_POS[permIndex];
    const orientations = ORI_DIGITS[oriIndex];
    const move = CANONICAL_TRANSFORMS[moveIndex];

    const o0 = (orientations[0] + move.oriDelta[positions[0]]) % 3;
    const o1 = (orientations[1] + move.oriDelta[positions[1]]) % 3;
    const o2 = (orientations[2] + move.oriDelta[positions[2]]) % 3;
    const o3 = (orientations[3] + move.oriDelta[positions[3]]) % 3;
    const o4 = (orientations[4] + move.oriDelta[positions[4]]) % 3;
    const o5 = (orientations[5] + move.oriDelta[positions[5]]) % 3;

    const nextOriIndex = (((((o0 * 3 + o1) * 3 + o2) * 3 + o3) * 3 + o4) * 3 + o5);
    return PERM_MOVE[permIndex * MOVE_COUNT + moveIndex] * ORI_COUNT + nextOriIndex;
}

function buildDistanceTable() {
    const distance = new Int8Array(CANONICAL_STATE_COUNT);
    distance.fill(-1);
    const queue = new Int32Array(CANONICAL_STATE_COUNT);

    distance[0] = 0;
    queue[0] = 0;
    let head = 0;
    let tail = 1;
    let visited = 1;
    let maxDepth = 0;

    while (head < tail) {
        const state = queue[head++];
        const depth = distance[state];
        if (depth > maxDepth) maxDepth = depth;

        for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
            const next = nextState(state, moveIndex);
            if (distance[next] === -1) {
                distance[next] = depth + 1;
                queue[tail++] = next;
                visited++;
            }
        }
    }

    return { distance, visited, maxDepth };
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

        if (visited !== CANONICAL_STATE_COUNT) {
            throw new Error(`2x2 BFS 覆盖不完整: ${visited}/${CANONICAL_STATE_COUNT}`);
        }

        cachedTables = {
            size: CANONICAL_STATE_COUNT,
            distance,
            maxDepth,
            buildMs: finishedAt - startedAt,
            moveCount: MOVE_COUNT,
            nextState,
            solve(index, randomInt) {
                if (!Number.isInteger(index) || index < 0 || index >= CANONICAL_STATE_COUNT) {
                    throw new RangeError(`2x2 状态索引越界: ${index}`);
                }
                if (distance[index] < 0) {
                    throw new Error(`2x2 状态不可达: ${index}`);
                }

                const path = [];
                let state = index;
                let guard = 0;
                while (state !== 0) {
                    const depth = distance[state];
                    const candidates = [];
                    for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
                        const next = nextState(state, moveIndex);
                        if (distance[next] === depth - 1) candidates.push(moveIndex);
                    }
                    if (!candidates.length) {
                        throw new Error(`2x2 状态 ${state} 找不到最短下降路径`);
                    }
                    const pick = candidates[randomInt(candidates.length)];
                    const transform = CANONICAL_TRANSFORMS[pick];
                    path.push(transform.variants[randomInt(transform.variants.length)]);
                    state = nextState(state, pick);
                    if (++guard > 64) throw new Error("2x2 求解循环过长");
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

// 供测试和外部校验使用：把一组动作作用到规范状态上。
export function applyCanonicalMoves(index, moves) {
    let state = index;
    for (const move of moves) state = applyCanonicalMove(state, move);
    return state;
}
