// WCA 4b3 规则与基础校验（M0）
//
// M0 只做结构校验；真正的最小步数（distance）需要各项目 solver 提供。
// 调用方可以传 { distance }，否则对 minMoves > 2 的项目会返回
// MIN_MOVES_NOT_VERIFIED 警告，而不是假装通过。

import { getEvent, RULES_VERSION } from "./events.js";
import { validateAlg } from "./notation.js";

export function getRule(eventId) {
    const event = getEvent(eventId);
    if (!event) return null;
    return Object.freeze({
        event: event.id,
        official: event.official,
        minMoves: event.minMoves,
        targetMaxMoves: event.targetMaxMoves,
        randomOrientation: event.randomOrientation,
        randomMoves: event.randomMoves,
        dedupe: event.dedupe,
        requireSlash: event.requireSlash,
        availableFrom: event.availableFrom || null,
    });
}

export function validateScramble(eventId, scramble, options = {}) {
    const event = getEvent(eventId);
    if (!event) {
        return {
            ok: false,
            event: null,
            errors: [{ code: "UNKNOWN_EVENT", message: `未知项目: ${eventId}` }],
            warnings: [],
            meta: null,
        };
    }

    const notation = validateAlg(scramble, event.scrambler);
    const errors = notation.errors.map((error) => ({ ...error }));
    const warnings = [];

    if (event.requireSlash && !notation.tokens.includes("/")) {
        errors.push({
            code: "MISSING_SLASH",
            message: "Square-1 打乱中没有 /，不满足 4b3d",
        });
    }

    if (options.distance !== undefined && options.distance !== null) {
        if (!Number.isFinite(options.distance)) {
            errors.push({
                code: "INVALID_DISTANCE",
                message: "distance 必须是有限数字",
            });
        } else if (options.distance < event.minMoves) {
            errors.push({
                code: "TOO_SHORT",
                message: `状态距离 ${options.distance} 小于项目下限 ${event.minMoves}`,
                minMoves: event.minMoves,
                distance: options.distance,
            });
        }
    } else if (event.minMoves > 2) {
        warnings.push({
            code: "MIN_MOVES_NOT_VERIFIED",
            message: `未提供 distance，无法验证最少 ${event.minMoves} 步的限制`,
            minMoves: event.minMoves,
        });
    }

    if (event.randomOrientation) {
        warnings.push({
            code: "ORIENTATION_NOT_VERIFIED",
            message: "盲拧项目要求随机朝向，M0 结构校验无法验证",
        });
    }

    if (event.randomMoves) {
        warnings.push({
            code: "RANDOM_MOVE_SCRAMBLE",
            message: "该项目按 WCA 4b3e 使用随机转动，状态距离由生成器保证",
        });
    }

    return {
        ok: errors.length === 0,
        event: event.id,
        errors,
        warnings,
        meta: {
            rulesVersion: RULES_VERSION,
            moveCount: notation.moveCount,
            minMoves: event.minMoves,
            targetMaxMoves: event.targetMaxMoves,
            randomMoves: event.randomMoves,
            randomOrientation: event.randomOrientation,
            dedupe: event.dedupe,
            requireSlash: event.requireSlash,
        },
    };
}

export function assertScramble(eventId, scramble, options = {}) {
    const result = validateScramble(eventId, scramble, options);
    if (!result.ok) {
        const error = new Error(`打乱不合法: ${eventId}`);
        error.code = "INVALID_SCRAMBLE";
        error.details = result;
        throw error;
    }
    return result;
}
