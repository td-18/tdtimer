// Skewb 全索引空间距离表（M1）
//
// 索引空间 9,447,840，其中 3,149,280 个状态可达。
// BFS 只在可达状态上扩散；未达状态 distance = -1，生成时过滤。

import {
    INDEX_COUNT,
    MOVE_VARIANTS,
    REACHABLE_COUNT,
    nextStateFromTables,
} from "./cubie.js";

const MOVE_COUNT = MOVE_VARIANTS.length;

function buildDistanceTable() {
    const distance = new Int8Array(INDEX_COUNT);
    distance.fill(-1);
    const queue = new Int32Array(REACHABLE_COUNT);

    distance[0] = 0;
    queue[0] = 0;
    let head = 0;
    let tail = 1;
    let maxDepth = 0;

    while (head < tail) {
        const state = queue[head++];
        const depth = distance[state];
        if (depth > maxDepth) maxDepth = depth;

        for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
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

        if (visited !== REACHABLE_COUNT) {
            throw new Error(`Skewb BFS 覆盖不完整: ${visited}/${REACHABLE_COUNT}`);
        }

        cachedTables = {
            indexCount: INDEX_COUNT,
            reachable: visited,
            distance,
            maxDepth,
            buildMs: finishedAt - startedAt,
            moveCount: MOVE_COUNT,
            nextState: nextStateFromTables,
            solve(index, randomInt) {
                if (!Number.isInteger(index) || index < 0 || index >= INDEX_COUNT) {
                    throw new RangeError(`Skewb 状态索引越界: ${index}`);
                }
                if (distance[index] < 0) {
                    throw new Error(`Skewb 状态不可达: ${index}`);
                }

                const path = [];
                let state = index;
                let guard = 0;
                while (state !== 0) {
                    const depth = distance[state];
                    const candidates = [];
                    for (let moveIndex = 0; moveIndex < MOVE_COUNT; moveIndex++) {
                        const next = nextStateFromTables(state, moveIndex);
                        if (distance[next] === depth - 1) candidates.push(moveIndex);
                    }
                    if (!candidates.length) {
                        throw new Error(`Skewb 状态 ${state} 找不到最短下降路径`);
                    }
                    const pick = candidates[randomInt(candidates.length)];
                    path.push(MOVE_VARIANTS[pick]);
                    state = nextStateFromTables(state, pick);
                    if (++guard > 64) throw new Error("Skewb 求解循环过长");
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
