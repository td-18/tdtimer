// 按需加载（feat/lazy-providers-prefetch）回归：
// 1) 注册时 11 个项目都能同步回答 capabilities（不加载实现体）
// 2) 只有被请求的项目才加载，其余保持未加载
// 3) 加载后 meta 换成真实对象（tableBuildMs 等运行期字段可读）

import test from "node:test";
import assert from "node:assert/strict";

import {
    registerBuiltinProviders,
    preloadBuiltinProvider,
    isBuiltinProviderLoaded,
    listBuiltinProviderIds,
} from "../src/scramble/wca/puzzles/index.js";
import { getProvider, clearProviders } from "../src/scramble/wca/providers.js";
import { getEvent } from "../src/scramble/wca/events.js";

test("注册时 11 个项目可同步读 algorithm，且都不加载实现体", () => {
    clearProviders();
    const ids = registerBuiltinProviders();

    assert.equal(ids.length, 11);
    assert.deepEqual([...ids].sort(), [...listBuiltinProviderIds()].sort());

    for (const id of ids) {
        const provider = getProvider(id);
        assert.ok(provider, `${id} 未注册`);
        assert.equal(typeof provider.meta.algorithm, "string", `${id} 缺少 algorithm`);
        assert.equal(provider.meta.scaffold, undefined, `${id} 不应是占位`);
        assert.equal(isBuiltinProviderLoaded(id), false, `${id} 不应在注册时加载`);
    }
});

test("按需加载：生成 333 只加载 333，其它项目保持未加载", async () => {
    clearProviders();
    registerBuiltinProviders();

    const event = getEvent("333");
    const provider = getProvider("333");
    const scrambles = await provider.generate({ event, count: 1 });

    assert.ok(Array.isArray(scrambles) && scrambles.length === 1, "333 应返回一条打乱");
    assert.ok(String(scrambles[0]).split(/\s+/).length >= 15, "333 打乱步数异常");

    assert.equal(isBuiltinProviderLoaded("333"), true);
    assert.equal(provider.meta.loaded, true);
    assert.equal(provider.meta.algorithm, "kociemba-two-phase-raw");
    assert.ok("tableBuildMs" in provider.meta, "加载后应换成真实 meta");

    for (const id of listBuiltinProviderIds()) {
        if (id === "333") continue;
        assert.equal(isBuiltinProviderLoaded(id), false, `${id} 不应被顺带加载`);
    }
});

test("预热只加载指定项目，不生成打乱", async () => {
    clearProviders();
    registerBuiltinProviders();

    const ok = await preloadBuiltinProvider("pyra");
    assert.equal(ok, true);
    assert.equal(isBuiltinProviderLoaded("pyra"), true);
    assert.equal(isBuiltinProviderLoaded("skewb"), false);
    assert.equal(isBuiltinProviderLoaded("444"), false);

    // 未知 id 不应抛错
    assert.equal(await preloadBuiltinProvider("nope"), false);
});

test("加载失败可重试（同一 provider 不会被永久锁死）", async () => {
    clearProviders();
    registerBuiltinProviders();

    const provider = getProvider("sq1");
    const originalLoad = provider.load;
    let calls = 0;

    // 包一层模拟第一次失败
    provider.load = function patchedLoad() {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error("模拟加载失败"));
        return originalLoad.call(provider);
    };

    await assert.rejects(() => provider.load(), /模拟加载失败/);
    assert.equal(isBuiltinProviderLoaded("sq1"), false);
    assert.equal(await provider.load(), provider.impl);
    assert.equal(isBuiltinProviderLoaded("sq1"), true);
});
