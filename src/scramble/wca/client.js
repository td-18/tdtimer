// 主线程侧的 scramble 服务（M0）
//
// 职责：
// - 懒创建 module worker
// - 请求/响应配对、超时、取消
// - 本地 provider 不可用时回退到 legacy（cubing.js）
// - 4x4 的 DELEGATE_LEGACY 也走这里，保持现有实现不变

import {
    ERROR_CODES,
    MESSAGE_TYPES,
    createCodedError,
    createRequest,
    isEvent,
    isResponse,
} from "./protocol.js";
import { RULES_VERSION, getEvent } from "./events.js";
import { generateLegacy } from "./legacy.js";

// 2x2/Pyraminx/Skewb 首次请求需要在 worker 内建表，默认给足 30 s。
const DEFAULT_TIMEOUT_MS = 30000;

function defaultWorkerFactory() {
    if (typeof Worker === "undefined") {
        throw createCodedError(ERROR_CODES.WORKER_UNAVAILABLE, "当前环境不支持 Web Worker");
    }
    return new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
}

function abortError() {
    const error = createCodedError(ERROR_CODES.CANCELLED, "打乱请求已取消");
    error.name = "AbortError";
    return error;
}

export class ScrambleService {
    constructor(options = {}) {
        this.workerFactory = options.workerFactory || defaultWorkerFactory;
        this.fallback = options.fallback || generateLegacy;
        this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
        this.logger = options.logger || console;

        this.worker = null;
        this.pending = new Map();
        this.seq = 0;
        this.capabilities = null;
        this.disposed = false;
    }

    _ensureWorker() {
        if (this.disposed) {
            throw createCodedError(ERROR_CODES.CANCELLED, "ScrambleService 已销毁");
        }
        if (this.worker) return this.worker;

        const worker = this.workerFactory();
        worker.addEventListener("message", (event) => this._onMessage(event.data));
        worker.addEventListener("error", (event) => this._onWorkerError(event));
        this.worker = worker;
        return worker;
    }

    _onMessage(message) {
        if (!message || typeof message !== "object") return;

        if (isEvent(message)) {
            const pending = this.pending.get(message.id);
            if (pending && typeof pending.onProgress === "function") {
                pending.onProgress(message.data);
            }
            return;
        }

        if (!isResponse(message)) return;

        const pending = this.pending.get(message.id);
        if (!pending) return;

        if (message.ok) {
            pending.resolve(message.result);
        } else {
            pending.reject(
                createCodedError(
                    message.error && message.error.code,
                    message.error && message.error.message,
                    message.error && message.error.details
                )
            );
        }
    }

    _onWorkerError(event) {
        const error = createCodedError(
            ERROR_CODES.WORKER_UNAVAILABLE,
            (event && event.message) || "scramble worker 运行时错误"
        );

        const pending = [...this.pending.values()];
        this.pending.clear();
        for (const entry of pending) entry.reject(error);

        this.worker = null;
        if (this.logger && typeof this.logger.error === "function") {
            this.logger.error("scramble worker error", event);
        }
    }

    _sendCancel(id) {
        if (!this.worker) return;
        try {
            this.worker.postMessage(createRequest(MESSAGE_TYPES.CANCEL, {}, id));
        } catch (error) {
            // worker 已关闭时忽略
        }
    }

    _request(type, payload, options = {}) {
        let worker;
        try {
            worker = this._ensureWorker();
        } catch (error) {
            return Promise.reject(
                createCodedError(
                    ERROR_CODES.WORKER_UNAVAILABLE,
                    error && error.message ? error.message : String(error)
                )
            );
        }

        const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.timeoutMs;
        const id = `req-${++this.seq}`;

        return new Promise((resolve, reject) => {
            let timer = null;
            let onAbort = null;
            let settled = false;

            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                this.pending.delete(id);
                if (onAbort && options.signal) {
                    options.signal.removeEventListener("abort", onAbort);
                }
                fn(value);
            };

            timer = setTimeout(() => {
                this._sendCancel(id);
                finish(
                    reject,
                    createCodedError(ERROR_CODES.TIMEOUT, `打乱 worker 超时 (${timeoutMs}ms)`)
                );
            }, timeoutMs);

            if (options.signal) {
                if (options.signal.aborted) {
                    finish(reject, abortError());
                    return;
                }
                onAbort = () => {
                    this._sendCancel(id);
                    finish(reject, abortError());
                };
                options.signal.addEventListener("abort", onAbort, { once: true });
            }

            this.pending.set(id, {
                onProgress: options.onProgress,
                resolve: (value) => finish(resolve, value),
                reject: (error) => finish(reject, error),
            });

            try {
                worker.postMessage(createRequest(type, payload, id));
            } catch (error) {
                finish(
                    reject,
                    createCodedError(
                        ERROR_CODES.WORKER_UNAVAILABLE,
                        error && error.message ? error.message : String(error)
                    )
                );
            }
        });
    }

    async getCapabilities() {
        if (this.capabilities) return this.capabilities;
        const result = await this._request(MESSAGE_TYPES.INIT, {});
        this.capabilities = result;
        return result;
    }

    async init(eventId, options = {}) {
        return this._request(
            MESSAGE_TYPES.INIT,
            { event: eventId },
            { timeoutMs: options.timeoutMs, signal: options.signal, onProgress: options.onProgress }
        );
    }

    async generate(eventId, options = {}) {
        const event = getEvent(eventId);
        if (!event) {
            throw createCodedError(ERROR_CODES.UNKNOWN_EVENT, `未知项目: ${eventId}`);
        }

        const count = options.count === undefined ? 1 : options.count;
        if (!Number.isInteger(count) || count < 1 || count > 100) {
            throw createCodedError(ERROR_CODES.BAD_REQUEST, "count 必须是 1..100 的整数");
        }

        const {
            signal,
            timeoutMs,
            fallback,
            allowReserved,
            onProgress,
            count: ignoredCount,
            ...solverOptions
        } = options;

        const allowFallback = fallback !== false;
        let workerError;

        try {
            const result = await this._request(
                MESSAGE_TYPES.GENERATE,
                { event: event.id, count, options: solverOptions },
                { timeoutMs, signal, onProgress }
            );

            if (event.dedupe && new Set(result.scrambles).size !== result.scrambles.length) {
                throw createCodedError(
                    ERROR_CODES.INVALID_SCRAMBLE,
                    `${event.id} 要求去重，但 worker 返回了重复打乱`
                );
            }

            return { ...result, source: "worker" };
        } catch (error) {
            if (error && (error.code === ERROR_CODES.CANCELLED || error.name === "AbortError")) {
                throw error;
            }
            workerError = error;
        }

        const canFallback =
            allowFallback &&
            event.legacyEventId &&
            (workerError.code === ERROR_CODES.NOT_IMPLEMENTED ||
                workerError.code === ERROR_CODES.DELEGATE_LEGACY ||
                workerError.code === ERROR_CODES.WORKER_UNAVAILABLE ||
                workerError.code === ERROR_CODES.TIMEOUT ||
                workerError.code === ERROR_CODES.INTERNAL ||
                (allowReserved && workerError.code === ERROR_CODES.EVENT_UNAVAILABLE));

        if (!canFallback) throw workerError;

        const scrambles = [];
        const seen = new Set();
        const maxAttempts = event.dedupe ? Math.max(count * 40, 200) : count;

        for (let attempt = 0; attempt < maxAttempts && scrambles.length < count; attempt++) {
            if (signal && signal.aborted) throw abortError();

            let scramble;
            try {
                scramble = await this.fallback(event.legacyEventId, { event });
            } catch (error) {
                throw createCodedError(
                    ERROR_CODES.ALL_SOURCES_FAILED,
                    `本地 provider 与 legacy 都无法生成 ${event.id} 打乱`,
                    {
                        workerCode: workerError && workerError.code,
                        fallbackCode: error && error.code,
                        cause: String(error),
                    }
                );
            }

            const text = String(scramble ?? "").trim();
            if (!text) continue;

            if (event.dedupe) {
                if (seen.has(text)) continue;
                seen.add(text);
            }
            scrambles.push(text);
        }

        if (scrambles.length !== count) {
            throw createCodedError(
                ERROR_CODES.ALL_SOURCES_FAILED,
                `无法生成 ${count} 条不重复的 ${event.id} 打乱`
            );
        }

        return {
            event: event.id,
            scrambler: event.scrambler,
            scrambles,
            source: "legacy",
            meta: {
                source: "legacy",
                rulesVersion: RULES_VERSION,
                fallbackReason: workerError && workerError.code ? workerError.code : null,
            },
        };
    }

    generateGroup(eventId, count, options = {}) {
        return this.generate(eventId, { ...options, count });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        const error = createCodedError(ERROR_CODES.CANCELLED, "ScrambleService 已销毁");
        const pending = [...this.pending.values()];
        this.pending.clear();
        for (const entry of pending) entry.reject(error);

        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.capabilities = null;
    }
}
