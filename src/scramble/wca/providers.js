// 本地打乱 provider 注册表（M0）
//
// M1 之后每个项目实现成一个 provider：
//   {
//     init?({ event, onProgress }) => Promise<void> | void,
//     generate({ event, count, options, onProgress }) => Promise<string[]> | string[],
//     meta?: object,
//   }
// 目前这里为空，worker 会按 events.js 的 local 状态回退到 legacy。

const providers = new Map();

export function registerProvider(scramblerId, provider) {
    if (typeof scramblerId !== "string" || !scramblerId) {
        throw new TypeError("registerProvider 需要一个非空 scrambler id");
    }
    if (!provider || typeof provider.generate !== "function") {
        throw new TypeError(`provider ${scramblerId} 缺少 generate()`);
    }
    providers.set(scramblerId, provider);
    return provider;
}

export function unregisterProvider(scramblerId) {
    return providers.delete(scramblerId);
}

export function getProvider(scramblerId) {
    return providers.get(scramblerId) || null;
}

export function listProviders() {
    return [...providers.keys()];
}

export function clearProviders() {
    providers.clear();
}
