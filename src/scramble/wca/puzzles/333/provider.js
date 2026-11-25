// 3x3 本地 provider（M1）
//
// 生成流程：随机合法状态 -> 二阶段求解 -> 取逆得到打乱 -> 双向校验。
// 盲拧项目需要随机朝向，M1 暂不在这里处理（交给 legacy 的 oriented scramble），
// 因此收到 randomOrientation 事件时返回 DELEGATE_LEGACY。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import {
    invertMoves,
    isSolved,
    movesToString,
    randomCube,
    simplifyMoves,
} from "./cubie.js";
import { getTables } from "./tables.js";
import { solveCube, verifyScramble, verifySolution } from "./search.js";

const TARGET_TOTAL = 21;
const MAX_ATTEMPTS = 16;
const DEFAULT_TIME_LIMIT_MS = 1200;

export function createThreeByThreeProvider() {
    let ready = null;

    const meta = {
        algorithm: "kociemba-two-phase-raw",
        targetTotal: TARGET_TOTAL,
        tableBuildMs: null,
        minLength: null,
        maxLength: null,
        avgLength: null,
        retries: 0,
    };

    async function ensureTables(onProgress) {
        if (!ready) {
            ready = getTables(onProgress);
        }
        return ready;
    }

    const provider = {
        meta,

        async init({ onProgress } = {}) {
            const tables = await ensureTables(onProgress);
            meta.tableBuildMs = tables.buildMs;
            return meta;
        },

        async generate({ event, count, options, onProgress }) {
            if (event && event.randomOrientation) {
                // 3BLD/3Multi 需要随机朝向；M1 先复用 cubing.js oriented scramble。
                throw createCodedError(
                    ERROR_CODES.DELEGATE_LEGACY,
                    `${event.id} 需要随机朝向，M1 交给 legacy`
                );
            }

            const tables = await ensureTables(onProgress);
            const maxTotal = options && options.maxTotal ? options.maxTotal : TARGET_TOTAL;
            const timeLimitMs = options && options.timeLimitMs ? options.timeLimitMs : DEFAULT_TIME_LIMIT_MS;
            const scrambles = [];
            let minLength = Infinity;
            let maxLength = 0;
            let totalLength = 0;
            let retries = 0;

            for (let i = 0; i < count; i++) {
                let text = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS && !text; attempt++) {
                    const cube = randomCube(randomInt);
                    if (isSolved(cube)) {
                        retries++;
                        continue;
                    }

                    const solution = solveCube(cube, tables, {
                        maxTotal,
                        maxPhase1Depth: 13,
                        maxPhase1Solutions: 64,
                        nodeLimit: 8000000,
                        timeLimitMs,
                    });

                    if (!solution || !solution.moves.length) {
                        retries++;
                        continue;
                    }

                    if (!verifySolution(cube, solution.moves)) {
                        throw createCodedError(
                            ERROR_CODES.INTERNAL,
                            "3x3 求解结果未回到复原态"
                        );
                    }

                    const scrambleMoves = simplifyMoves(invertMoves(solution.moves));
                    if (scrambleMoves.length < 2) {
                        retries++;
                        continue;
                    }

                    // 独立检查：把打乱作用到复原态，应得到同一个随机状态。
                    if (!verifyScramble(cube, scrambleMoves)) {
                        throw createCodedError(
                            ERROR_CODES.INTERNAL,
                            "3x3 打乱与随机状态不一致"
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
                        `3x3 在 ${MAX_ATTEMPTS} 次尝试内没有生成合法打乱`
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

    return provider;
}
