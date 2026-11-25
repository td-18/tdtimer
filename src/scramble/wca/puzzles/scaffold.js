// 架构占位 provider（M1）
//
// Clock / Square-1 / Megaminx 在 M1 只接通 provider 契约：
// - capabilities / init 能报告 scaffold 状态
// - generate 明确返回 DELEGATE_LEGACY，由主线程 client 回退到 legacy
// 真正的随机状态求解器分别在 M2 / M2 / M4 替换本文件。

import { createCodedError, ERROR_CODES } from "../protocol.js";

export function createScaffoldProvider({ algorithm, milestone, note, randomState = true }) {
    const meta = Object.freeze({
        algorithm,
        milestone,
        note,
        randomState,
        scaffold: true,
    });

    return {
        meta,
        init() {
            return meta;
        },
        async generate() {
            throw createCodedError(
                ERROR_CODES.DELEGATE_LEGACY,
                `${note}（计划 ${milestone} 接入）`
            );
        },
    };
}
