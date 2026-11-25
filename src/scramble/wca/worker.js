// scramble worker（M1）
//
// 只负责：能力查询、事件初始化、调用已注册的 provider、结构校验、取消。
// M1 的本地 provider：333 / 222 / pyra / skewb；clock / sq1 / minx 为架构占位，
// generate 返回 DELEGATE_LEGACY；4x4 仍由主线程 client 走 legacy。

import {
    ERROR_CODES,
    MESSAGE_TYPES,
    PROTOCOL_VERSION,
    createError,
    createEvent,
    createResponse,
    isRequest,
} from "./protocol.js";
import {
    LOCAL_STATUS,
    RULES_VERSION,
    getEvent,
    getScrambler,
    listOfficialEvents,
    listScramblers,
} from "./events.js";
import { getProvider } from "./providers.js";
import { validateScramble } from "./rules.js";
import { registerBuiltinProviders } from "./puzzles/index.js";

registerBuiltinProviders();

const cancelled = new Set();

function postProgress(id, data) {
    self.postMessage(createEvent(id, "progress", data));
}

function buildCapabilities() {
    return {
        protocol: PROTOCOL_VERSION,
        rulesVersion: RULES_VERSION,
        events: listOfficialEvents().map((event) => ({
            id: event.id,
            name: event.name,
            nameZh: event.nameZh,
            scrambler: event.scrambler,
            minMoves: event.minMoves,
            targetMaxMoves: event.targetMaxMoves,
            randomOrientation: event.randomOrientation,
            randomMoves: event.randomMoves,
            dedupe: event.dedupe,
        })),
        scramblers: listScramblers().map((scrambler) => {
            const provider = getProvider(scrambler.id);
            const meta = provider && provider.meta ? provider.meta : null;
            const scaffold = !!(meta && meta.scaffold);
            return {
                id: scrambler.id,
                label: scrambler.label,
                local: scrambler.local,
                legacyEventId: scrambler.legacyEventId,
                availableFrom: scrambler.availableFrom || null,
                note: scrambler.note || "",
                hasProvider: !!provider,
                implemented: !!provider && !scaffold,
                scaffold,
                algorithm: meta && meta.algorithm ? meta.algorithm : null,
            };
        }),
    };
}

function resolveTarget(eventId) {
    const event = getEvent(eventId);
    if (!event) {
        return { error: createError(null, ERROR_CODES.UNKNOWN_EVENT, `未知项目: ${eventId}`) };
    }
    const scrambler = getScrambler(event);
    if (!scrambler) {
        return { error: createError(null, ERROR_CODES.INTERNAL, `项目 ${event.id} 没有 scrambler`) };
    }
    return { event, scrambler };
}

async function handleInit(request) {
    const eventId = request.payload && request.payload.event;
    if (!eventId) {
        return createResponse(request.id, buildCapabilities());
    }

    const target = resolveTarget(eventId);
    if (target.error) {
        target.error.id = request.id;
        return target.error;
    }

    const { event, scrambler } = target;
    if (scrambler.local === LOCAL_STATUS.RESERVED) {
        return createError(
            request.id,
            ERROR_CODES.EVENT_UNAVAILABLE,
            `${event.id} 尚未启用`,
            { availableFrom: scrambler.availableFrom || null, note: scrambler.note || "" }
        );
    }

    const provider = getProvider(scrambler.id);
    if (!provider) {
        return createResponse(request.id, {
            event: event.id,
            status: scrambler.local,
            available: false,
            note: scrambler.note || "",
        });
    }

    try {
        if (typeof provider.init === "function") {
            await provider.init({
                event,
                onProgress: (data) => postProgress(request.id, data),
            });
        }
        const scaffold = !!(provider.meta && provider.meta.scaffold);
        return createResponse(request.id, {
            event: event.id,
            status: scaffold ? LOCAL_STATUS.SCAFFOLDED : LOCAL_STATUS.READY,
            available: !scaffold,
            meta: provider.meta || null,
        });
    } catch (error) {
        return createError(
            request.id,
            error && error.code ? error.code : ERROR_CODES.INTERNAL,
            error && error.message ? error.message : String(error),
            error && error.details
        );
    }
}

async function handleGenerate(request) {
    const payload = request.payload || {};
    const count = payload.count === undefined ? 1 : payload.count;

    if (!Number.isInteger(count) || count < 1 || count > 100) {
        return createError(request.id, ERROR_CODES.BAD_REQUEST, "count 必须是 1..100 的整数");
    }

    const target = resolveTarget(payload.event);
    if (target.error) {
        target.error.id = request.id;
        return target.error;
    }

    const { event, scrambler } = target;

    if (scrambler.local === LOCAL_STATUS.RESERVED) {
        return createError(
            request.id,
            ERROR_CODES.EVENT_UNAVAILABLE,
            `${event.id} 尚未启用`,
            { availableFrom: scrambler.availableFrom || null, note: scrambler.note || "" }
        );
    }

    const provider = getProvider(scrambler.id);
    if (!provider) {
        if (scrambler.local === LOCAL_STATUS.DELEGATED) {
            return createError(
                request.id,
                ERROR_CODES.DELEGATE_LEGACY,
                `${event.id} 由现有实现负责`,
                { scrambler: scrambler.id, legacyEventId: event.legacyEventId }
            );
        }
        return createError(
            request.id,
            ERROR_CODES.NOT_IMPLEMENTED,
            `${event.id} 的本地 provider 尚未实现`,
            { scrambler: scrambler.id, local: scrambler.local }
        );
    }

    if (provider.meta && provider.meta.scaffold) {
        return createError(
            request.id,
            ERROR_CODES.DELEGATE_LEGACY,
            `${event.id} 的本地 provider 仍处于架构占位阶段`,
            {
                scrambler: scrambler.id,
                milestone: provider.meta.milestone || null,
                note: provider.meta.note || "",
            }
        );
    }

    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    let scrambles;

    try {
        scrambles = await provider.generate({
            event,
            count,
            options: payload.options || {},
            onProgress: (data) => postProgress(request.id, data),
        });
    } catch (error) {
        return createError(
            request.id,
            error && error.code ? error.code : ERROR_CODES.INTERNAL,
            error && error.message ? error.message : String(error),
            error && error.details
        );
    }

    if (!Array.isArray(scrambles) || scrambles.length !== count) {
        return createError(
            request.id,
            ERROR_CODES.INTERNAL,
            `provider 返回了 ${Array.isArray(scrambles) ? scrambles.length : "非数组"} 条打乱，期望 ${count} 条`
        );
    }

    if (event.dedupe && new Set(scrambles).size !== scrambles.length) {
        return createError(
            request.id,
            ERROR_CODES.INVALID_SCRAMBLE,
            `${event.id} 要求去重，但 provider 返回了重复打乱`
        );
    }

    const validations = scrambles.map((scramble) => validateScramble(event.id, scramble));
    const invalid = validations.filter((result) => !result.ok);
    if (invalid.length) {
        return createError(
            request.id,
            ERROR_CODES.INVALID_SCRAMBLE,
            `provider 生成了 ${invalid.length} 条不合法打乱`,
            { validation: invalid }
        );
    }

    if (cancelled.has(request.id)) {
        cancelled.delete(request.id);
        return null;
    }

    const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    return createResponse(request.id, {
        event: event.id,
        scrambler: scrambler.id,
        scrambles,
        meta: {
            source: "worker",
            rulesVersion: RULES_VERSION,
            count,
            durationMs: finishedAt - startedAt,
            warnings: validations.flatMap((result) => result.warnings),
            ...(provider.meta || {}),
        },
    });
}

function handleCancel(request) {
    cancelled.add(request.id);
    return createResponse(request.id, { cancelled: true });
}

function handleRequest(request) {
    switch (request.type) {
        case MESSAGE_TYPES.PING:
            return createResponse(request.id, { pong: true, now: Date.now() });
        case MESSAGE_TYPES.INIT:
            return handleInit(request);
        case MESSAGE_TYPES.GENERATE:
            return handleGenerate(request);
        case MESSAGE_TYPES.CANCEL:
            return handleCancel(request);
        default:
            return createError(
                request.id,
                ERROR_CODES.BAD_REQUEST,
                `未知消息类型: ${request.type}`
            );
    }
}

const isWorkerScope =
    typeof self !== "undefined" &&
    typeof self.postMessage === "function" &&
    typeof document === "undefined";

if (isWorkerScope) {
    self.addEventListener("message", (event) => {
        const request = event.data;

        if (!isRequest(request)) {
            if (request && request.id) {
                self.postMessage(
                    createError(request.id, ERROR_CODES.BAD_REQUEST, "不是有效的协议请求")
                );
            }
            return;
        }

        Promise.resolve()
            .then(() => handleRequest(request))
            .then((response) => {
                if (response) self.postMessage(response);
            })
            .catch((error) => {
                self.postMessage(
                    createError(
                        request.id,
                        error && error.code ? error.code : ERROR_CODES.INTERNAL,
                        error && error.message ? error.message : String(error),
                        error && error.details
                    )
                );
            });
    });
}
