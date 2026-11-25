// 主线程 <-> scramble worker 协议（M0）
//
// 请求：{ protocol, kind: "request", id, type, payload }
// 成功：{ protocol, kind: "response", id, ok: true, result }
// 失败：{ protocol, kind: "response", id, ok: false, error: { code, message, details } }
// 进度：{ protocol, kind: "event", id, event: "progress", data }

export const PROTOCOL_VERSION = 1;

export const MESSAGE_TYPES = Object.freeze({
    PING: "ping",
    INIT: "init",
    GENERATE: "generate",
    CANCEL: "cancel",
});

export const ERROR_CODES = Object.freeze({
    BAD_REQUEST: "BAD_REQUEST",
    UNKNOWN_EVENT: "UNKNOWN_EVENT",
    EVENT_UNAVAILABLE: "EVENT_UNAVAILABLE",
    NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
    DELEGATE_LEGACY: "DELEGATE_LEGACY",
    TIMEOUT: "TIMEOUT",
    CANCELLED: "CANCELLED",
    WORKER_UNAVAILABLE: "WORKER_UNAVAILABLE",
    LEGACY_UNAVAILABLE: "LEGACY_UNAVAILABLE",
    INVALID_SCRAMBLE: "INVALID_SCRAMBLE",
    ALL_SOURCES_FAILED: "ALL_SOURCES_FAILED",
    INTERNAL: "INTERNAL",
});

let requestCounter = 0;

export function createRequest(type, payload = {}, id) {
    return {
        protocol: PROTOCOL_VERSION,
        kind: "request",
        id: id || `req-${++requestCounter}`,
        type,
        payload,
    };
}

export function createResponse(id, result) {
    return {
        protocol: PROTOCOL_VERSION,
        kind: "response",
        id,
        ok: true,
        result,
    };
}

export function createError(id, code, message, details) {
    return {
        protocol: PROTOCOL_VERSION,
        kind: "response",
        id,
        ok: false,
        error: {
            code: code || ERROR_CODES.INTERNAL,
            message: message || "未知错误",
            ...(details === undefined ? {} : { details }),
        },
    };
}

export function createEvent(id, event, data) {
    return {
        protocol: PROTOCOL_VERSION,
        kind: "event",
        id,
        event,
        data,
    };
}

export function createCodedError(code, message, details) {
    const error = new Error(message || code || "未知错误");
    error.code = code || ERROR_CODES.INTERNAL;
    if (details !== undefined) error.details = details;
    return error;
}

export function isRequest(message) {
    return !!message && message.protocol === PROTOCOL_VERSION && message.kind === "request";
}

export function isResponse(message) {
    return !!message && message.protocol === PROTOCOL_VERSION && message.kind === "response";
}

export function isEvent(message) {
    return !!message && message.protocol === PROTOCOL_VERSION && message.kind === "event";
}
