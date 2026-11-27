export class LoadTimeoutError extends Error {
    constructor(label, timeoutMs) {
        super(`${label}加载超时 (${timeoutMs}ms)`);
        this.name = "LoadTimeoutError";
        this.code = "LOAD_TIMEOUT";
        this.timeoutMs = timeoutMs;
    }
}

export function settleWithin(promise, timeoutMs, label = "资源") {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new LoadTimeoutError(label, timeoutMs));
        }, timeoutMs);

        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
