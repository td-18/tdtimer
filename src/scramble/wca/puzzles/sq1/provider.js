// Square-1 本地 provider（M2）
//
// 随机状态 -> 形状两阶段搜索 -> 记号化打乱。
// 4b3d 要求至少 11 步，并且打乱状态允许直接做 /；输出至少 11 个 /。
// provider 内部会用状态模拟器做逆序列复算。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import {
    SQ1_MIN_SLASHES,
    applyScramble,
    countSlashes,
    getRandomSquareOneScramble,
    initTables,
    invertScramble,
    isSolvedCube,
    newCube,
} from "./sq1.js";

const MAX_ATTEMPTS = 32;

export function createSquareOneProvider() {
    const meta = {
        algorithm: "two-phase-random-state",
        randomState: true,
        minMoves: SQ1_MIN_SLASHES,
        minSlashes: SQ1_MIN_SLASHES,
        tableBuildMs: null,
        minLength: null,
        maxLength: null,
        avgLength: null,
        retries: 0,
    };

    return {
        meta,

        async init({ onProgress } = {}) {
            if (typeof onProgress === "function") onProgress({ phase: "init", percent: 5 });
            const tables = initTables();
            meta.tableBuildMs = tables.buildMs;
            if (typeof onProgress === "function") onProgress({ phase: "init", percent: 100 });
            return meta;
        },

        async generate({ count, options, onProgress }) {
            const tables = initTables();
            meta.tableBuildMs = tables.buildMs;
            const random = options && typeof options.rng === "function" ? options.rng : randomInt;

            const scrambles = [];
            let minLength = Infinity;
            let maxLength = 0;
            let totalLength = 0;
            let retries = 0;

            for (let i = 0; i < count; i++) {
                let text = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS && !text; attempt++) {
                    const candidate = getRandomSquareOneScramble(random);
                    if (!candidate) {
                        retries++;
                        continue;
                    }
                    if (countSlashes(candidate) < SQ1_MIN_SLASHES) {
                        retries++;
                        continue;
                    }

                    // 独立复算：从复原态应用打乱，再应用逆序列应回到复原态。
                    const scrambled = applyScramble(newCube(), candidate);
                    const back = applyScramble(scrambled, invertScramble(candidate));
                    if (!isSolvedCube(back)) {
                        throw createCodedError(
                            ERROR_CODES.INTERNAL,
                            "Square-1 打乱逆序列复算失败"
                        );
                    }

                    text = candidate.trim();
                    const length = countSlashes(text);
                    minLength = Math.min(minLength, length);
                    maxLength = Math.max(maxLength, length);
                    totalLength += length;
                }

                if (!text) {
                    throw createCodedError(
                        ERROR_CODES.INTERNAL,
                        `Square-1 在 ${MAX_ATTEMPTS} 次尝试内没有生成合法打乱`
                    );
                }

                scrambles.push(text);
                if (typeof onProgress === "function") {
                    onProgress({ phase: "solve", current: i + 1, total: count });
                }
            }

            meta.minLength = Number.isFinite(minLength) ? minLength : 0;
            meta.maxLength = maxLength;
            meta.avgLength = count ? totalLength / count : 0;
            meta.retries = retries;

            return scrambles;
        },
    };
}
