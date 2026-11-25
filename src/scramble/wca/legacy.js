// legacy 适配器（M0）
//
// 复用现有 cubing.js randomScrambleForEvent，作为本地 provider 尚未实现时的兜底。
// 4x4 在 M0 明确走这里：不改变现有 4x4 实现。

import { ERROR_CODES, createCodedError } from "./protocol.js";

let modulePromise = null;

export function loadLegacyScrambleModule() {
    if (!modulePromise) {
        modulePromise = import("https://cdn.cubing.net/v0/js/cubing/scramble").catch((error) => {
            modulePromise = null;
            throw error;
        });
    }
    return modulePromise;
}

export async function generateLegacy(legacyEventId) {
    let module;
    try {
        module = await loadLegacyScrambleModule();
    } catch (error) {
        throw createCodedError(
            ERROR_CODES.LEGACY_UNAVAILABLE,
            "cubing.js 加载失败，legacy 兜底不可用",
            { cause: String(error) }
        );
    }

    if (!module || typeof module.randomScrambleForEvent !== "function") {
        throw createCodedError(
            ERROR_CODES.LEGACY_UNAVAILABLE,
            "cubing.js 没有 randomScrambleForEvent"
        );
    }

    try {
        const alg = await module.randomScrambleForEvent(legacyEventId);
        return typeof alg === "string" ? alg : alg.toString();
    } catch (error) {
        throw createCodedError(
            ERROR_CODES.LEGACY_UNAVAILABLE,
            `cubing.js 无法生成 ${legacyEventId} 打乱`,
            { cause: String(error) }
        );
    }
}
