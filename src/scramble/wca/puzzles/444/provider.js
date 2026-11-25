// SPDX-License-Identifier: GPL-3.0-only
//
// 4x4x4 本地 provider（M3）
//
// 使用离线打包的 4x4 随机状态求解器：
//   - 初始化阶段构建中心/棱块剪枝表（约 1.5–2 s）；
//   - 每个随机状态通过 reduction + 3x3 求解，输出 40–50 步打乱；
//   - 求解器表在同一 worker 内缓存，后续生成约 150–250 ms。
//
// 进度：
//   init   -> { phase: "init", stage, percent }
//   solve  -> { phase: "solve", current, total }

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import {
    generateFourByFourScramble,
    initFourByFourSolver,
    setSolverProgressCallback,
} from "./solver.js";

const MAX_ATTEMPTS = 4;

export function createFourByFourProvider() {
    let ready = null;

    const meta = {
        algorithm: "reduction-random-state",
        randomState: true,
        tableBuildMs: null,
        minLength: null,
        maxLength: null,
        avgLength: null,
        retries: 0,
    };

    function ensureSolver(onProgress) {
        if (!ready) {
            setSolverProgressCallback(onProgress);
            const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
            initFourByFourSolver();
            const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
            meta.tableBuildMs = finishedAt - startedAt;
            ready = true;
        }
        return ready;
    }

    return {
        meta,

        async init({ onProgress } = {}) {
            ensureSolver(onProgress);
            return meta;
        },

        async generate({ event, count, onProgress }) {
            if (event && event.randomOrientation) {
                // 4BLD 需要随机朝向；与 3BLD/5BLD 一样交给 legacy。
                throw createCodedError(
                    ERROR_CODES.DELEGATE_LEGACY,
                    `${event.id} 需要随机朝向，M3 交给 legacy`
                );
            }

            ensureSolver(onProgress);

            const scrambles = [];
            let minLength = Infinity;
            let maxLength = 0;
            let totalLength = 0;
            let retries = 0;

            for (let i = 0; i < count; i++) {
                let text = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS && !text; attempt++) {
                    try {
                        const candidate = String(generateFourByFourScramble() || "").trim();
                        if (!candidate) {
                            retries++;
                            continue;
                        }
                        text = candidate;
                    } catch (error) {
                        retries++;
                    }
                }

                if (!text) {
                    throw createCodedError(
                        ERROR_CODES.INTERNAL,
                        `4x4 在 ${MAX_ATTEMPTS} 次尝试内没有生成合法打乱`
                    );
                }

                const length = text.split(/\s+/).filter(Boolean).length;
                minLength = Math.min(minLength, length);
                maxLength = Math.max(maxLength, length);
                totalLength += length;
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
