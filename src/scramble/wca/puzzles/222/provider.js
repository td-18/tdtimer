// 2x2 本地 provider（M1）
//
// 流程：均匀随机规范状态 -> 全表 BFS 最短解 -> 取逆得到打乱 -> 从复原态复算校验。
// WCA 4b3b 要求状态至少 4 步可解；距离 <4 的状态会被重新抽取。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import {
    CANONICAL_STATE_COUNT,
    invertMoves,
    movesToString,
} from "./cubie.js";
import { getTables } from "./tables.js";

const MIN_DISTANCE = 4;
const MAX_ATTEMPTS = 64;

export function createTwoByTwoProvider() {
    let ready = null;

    const meta = {
        algorithm: "full-bfs-optimal",
        randomState: true,
        stateCount: CANONICAL_STATE_COUNT,
        minDistance: MIN_DISTANCE,
        targetMaxMoves: 11,
        tableBuildMs: null,
        minLength: null,
        maxLength: null,
        avgLength: null,
        retries: 0,
    };

    function ensureTables(onProgress) {
        if (!ready) ready = getTables(onProgress);
        return ready;
    }

    return {
        meta,

        async init({ onProgress } = {}) {
            const tables = await ensureTables(onProgress);
            meta.tableBuildMs = tables.buildMs;
            return meta;
        },

        async generate({ count, options, onProgress }) {
            const tables = await ensureTables(onProgress);
            const random = options && typeof options.rng === "function" ? options.rng : randomInt;

            const scrambles = [];
            let minLength = Infinity;
            let maxLength = 0;
            let totalLength = 0;
            let retries = 0;

            for (let i = 0; i < count; i++) {
                let text = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS && !text; attempt++) {
                    const state = random(CANONICAL_STATE_COUNT);
                    const distance = tables.distance[state];

                    if (distance < MIN_DISTANCE) {
                        retries++;
                        continue;
                    }

                    const solution = tables.solve(state, random);
                    const scrambleMoves = invertMoves(solution);

                    let check = 0;
                    for (const move of scrambleMoves) {
                        check = tables.nextState(check, move.transformIndex);
                    }
                    if (check !== state) {
                        throw createCodedError(
                            ERROR_CODES.INTERNAL,
                            `2x2 打乱校验失败: 期望状态 ${state}，实际 ${check}`
                        );
                    }

                    text = movesToString(scrambleMoves);
                    minLength = Math.min(minLength, scrambleMoves.length);
                    maxLength = Math.max(maxLength, scrambleMoves.length);
                    totalLength += scrambleMoves.length;
                }

                if (!text) {
                    throw createCodedError(
                        ERROR_CODES.INTERNAL,
                        `2x2 在 ${MAX_ATTEMPTS} 次尝试内没有生成合法打乱`
                    );
                }

                scrambles.push(text);
                if (typeof onProgress === "function") {
                    onProgress({ phase: "solve", current: i + 1, total: count });
                }
            }

            meta.tableBuildMs = tables.buildMs;
            meta.minLength = Number.isFinite(minLength) ? minLength : 0;
            meta.maxLength = maxLength;
            meta.avgLength = count ? totalLength / count : 0;
            meta.retries = retries;

            return scrambles;
        },
    };
}
