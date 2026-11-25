// 大魔方随机转动 provider 工厂（M3）
//
// 同一套生成逻辑服务 555 / 666 / 777，只是步数和最大宽层不同。

import { createCodedError, ERROR_CODES } from "../../protocol.js";
import { randomInt } from "../../rng.js";
import { generateBigCubeScramble, getBigCubeConfig } from "./random.js";

export function createBigCubeProvider(eventId) {
    const config = getBigCubeConfig(eventId);
    if (!config) throw new Error(`没有大魔方配置: ${eventId}`);

    const meta = {
        algorithm: "random-move",
        randomState: false,
        randomMoves: true,
        size: config.size,
        moveCount: config.moves,
        maxLayers: config.maxLayers,
        targetMaxMoves: config.moves,
        tableBuildMs: 0,
    };

    return {
        meta,

        init() {
            return meta;
        },

        async generate({ event, count, options, onProgress }) {
            if (event && event.randomOrientation) {
                // 5BLD 需要随机朝向；与 3BLD 一样先交给 legacy 的 oriented scramble。
                throw createCodedError(
                    ERROR_CODES.DELEGATE_LEGACY,
                    `${event.id} 需要随机朝向，M3 交给 legacy`
                );
            }

            const random = options && typeof options.rng === "function" ? options.rng : randomInt;
            const scrambles = [];

            for (let i = 0; i < count; i++) {
                scrambles.push(generateBigCubeScramble(config, random));
                if (typeof onProgress === "function") {
                    onProgress({ phase: "scramble", current: i + 1, total: count });
                }
            }

            return scrambles;
        },
    };
}
