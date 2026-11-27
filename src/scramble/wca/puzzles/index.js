// 本地 solver 注册入口（M1）
//
// 按需加载（feat/lazy-providers-prefetch）：
// 这里只登记「项目 → 加载器」，不再静态 import 各项目实现。
// 好处：worker 只在某项目被选择/需要时才拉取对应代码，
// 首条打乱不必再为没在玩的项目付下载成本（4x4 求解器单项目就 200KB+）。
//
// 约束：worker 的 capabilities 查询是同步读 provider.meta 的，
// 所以在登记表里保留 algorithm 字段作为「加载前的静态 meta」；
// 实现体加载完成后会把 meta 换成 provider 的真实 meta（含 tableBuildMs 等运行期字段）。

import { registerProvider } from "../providers.js";

// 11 个内置项目：id 与 events.js 的 scrambler.id 一致。
// algorithm 只用于加载前的能力查询，真实值以各 provider 的 meta 为准。
const BUILTINS = [
    {
        id: "333",
        algorithm: "kociemba-two-phase-raw",
        load: () => import("./333/provider.js").then((m) => m.createThreeByThreeProvider),
    },
    {
        id: "222",
        algorithm: "full-bfs-optimal",
        load: () => import("./222/provider.js").then((m) => m.createTwoByTwoProvider),
    },
    {
        id: "444",
        algorithm: "reduction-random-state",
        load: () => import("./444/provider.js").then((m) => m.createFourByFourProvider),
    },
    {
        id: "pyra",
        algorithm: "full-bfs-optimal",
        load: () => import("./pyra/provider.js").then((m) => m.createPyraminxProvider),
    },
    {
        id: "skewb",
        algorithm: "full-bfs-optimal",
        load: () => import("./skewb/provider.js").then((m) => m.createSkewbProvider),
    },
    {
        id: "clock",
        algorithm: "linear-algebra-random-state",
        load: () => import("./clock/provider.js").then((m) => m.createClockProvider),
    },
    {
        id: "sq1",
        algorithm: "two-phase-random-state",
        load: () => import("./sq1/provider.js").then((m) => m.createSquareOneProvider),
    },
    {
        id: "555",
        algorithm: "random-move",
        load: () => import("./555/provider.js").then((m) => m.createFiveByFiveProvider),
    },
    {
        id: "666",
        algorithm: "random-move",
        load: () => import("./666/provider.js").then((m) => m.createSixBySixProvider),
    },
    {
        id: "777",
        algorithm: "random-move",
        load: () => import("./777/provider.js").then((m) => m.createSevenBySevenProvider),
    },
    {
        id: "minx",
        algorithm: "random-move",
        load: () => import("./minx/provider.js").then((m) => m.createMegaminxProvider),
    },
];

// scrambler id → 惰性 provider，供 preloadBuiltinProvider 找到代理对象
const lazyProviders = new Map();

function createLazyProvider(entry) {
    let loading = null;

    const provider = {
        // 加载前的静态 meta：capabilities / 测试只同步读 algorithm 与 scaffold
        meta: { algorithm: entry.algorithm, lazy: true, loaded: false },
        implemented: true,

        isLoaded() {
            return !!(provider.impl);
        },

        load() {
            if (!loading) {
                loading = Promise.resolve()
                    .then(entry.load)
                    .then((factory) => {
                        if (typeof factory !== "function") {
                            throw new TypeError(`provider ${entry.id} 的加载结果不是工厂函数`);
                        }
                        const impl = factory();
                        provider.impl = impl;
                        // 换成真实 meta 对象本体（不能拷贝：provider 会在 init 里回写
                        // tableBuildMs 等字段，拷贝会让外部读到过期值）
                        if (impl.meta && typeof impl.meta === "object") {
                            impl.meta.lazy = true;
                            impl.meta.loaded = true;
                            provider.meta = impl.meta;
                        }
                        return impl;
                    })
                    .catch((error) => {
                        // 失败后允许下次重试
                        loading = null;
                        throw error;
                    });
            }
            return loading;
        },

        async init(context) {
            const impl = await provider.load();
            return typeof impl.init === "function" ? impl.init(context) : undefined;
        },

        async generate(context) {
            const impl = await provider.load();
            return impl.generate(context);
        },
    };

    return provider;
}

export function registerBuiltinProviders() {
    for (const entry of BUILTINS) {
        const provider = createLazyProvider(entry);
        lazyProviders.set(entry.id, provider);
        registerProvider(entry.id, provider);
    }
    return BUILTINS.map((entry) => entry.id);
}

// 只加载某个项目的实现体，不生成打乱。
// 供「项目被选择」时预热使用，避免选的瞬间还要等下载 + 建表。
export function preloadBuiltinProvider(scramblerId) {
    const provider = lazyProviders.get(scramblerId);
    if (!provider) return Promise.resolve(false);
    return provider.load().then(() => true);
}

export function isBuiltinProviderLoaded(scramblerId) {
    const provider = lazyProviders.get(scramblerId);
    return !!(provider && provider.isLoaded());
}

export function listBuiltinProviderIds() {
    return BUILTINS.map((entry) => entry.id);
}
