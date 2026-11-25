// Clock 本地 provider（M2）
//
// 随机 14 个独立表盘 -> 线性代数分解成 18 个动作 -> 输出 WCA Clock 记法。
// 4b3 要求至少 2 步；状态距离 <2 会被重抽。引脚（UR/DR/DL/UL）随机。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import { generateClockScramble, MIN_MOVES, STATE_COUNT } from "./clock.js";

const MAX_ATTEMPTS = 64;

export function createClockProvider() {
    const meta = {
        algorithm: "linear-algebra-random-state",
        randomState: true,
        stateCount: STATE_COUNT,
        minDistance: MIN_MOVES,
        pinRandomized: true,
        minLength: null,
        maxLength: null,
        avgLength: null,
        retries: 0,
    };

    return {
        meta,

        init() {
            return meta;
        },

        async generate({ count, options, onProgress }) {
            const random = options && typeof options.rng === "function" ? options.rng : randomInt;

            const scrambles = [];
            let minLength = Infinity;
            let maxLength = 0;
            let totalLength = 0;
            let retries = 0;

            for (let i = 0; i < count; i++) {
                let text = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS && !text; attempt++) {
                    const result = generateClockScramble(random);
                    if (!result) {
                        retries++;
                        continue;
                    }
                    text = result.text;
                    const length = text.split(/\s+/).length;
                    minLength = Math.min(minLength, length);
                    maxLength = Math.max(maxLength, length);
                    totalLength += length;
                }

                if (!text) {
                    throw createCodedError(
                        ERROR_CODES.INTERNAL,
                        `Clock 在 ${MAX_ATTEMPTS} 次尝试内没有生成合法打乱`
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
