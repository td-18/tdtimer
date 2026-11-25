// Megaminx 本地 provider（M4）
//
// 7 行 × (5 组 R/D + U/U')，共 77 个随机转动。
// WCA 4b3e 允许 Megaminx 使用随机转动，不要求随机状态。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import { generateMegaminxScramble, MINX_MOVE_COUNT } from "./random.js";

export function createMegaminxProvider() {
    const meta = {
        algorithm: "random-move",
        randomState: false,
        randomMoves: true,
        moveCount: MINX_MOVE_COUNT,
        lines: 7,
        pairsPerLine: 5,
        targetMaxMoves: MINX_MOVE_COUNT,
        tableBuildMs: 0,
    };

    return {
        meta,

        init() {
            return meta;
        },

        async generate({ event, count, options, onProgress }) {
            if (event && event.randomOrientation) {
                throw createCodedError(
                    ERROR_CODES.DELEGATE_LEGACY,
                    `${event.id} 需要随机朝向，M4 交给 legacy`
                );
            }

            const random = options && typeof options.rng === "function" ? options.rng : randomInt;
            const scrambles = [];

            for (let i = 0; i < count; i++) {
                scrambles.push(generateMegaminxScramble(random));
                if (typeof onProgress === "function") {
                    onProgress({ phase: "scramble", current: i + 1, total: count });
                }
            }

            return scrambles;
        },
    };
}
