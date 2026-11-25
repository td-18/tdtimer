import test from "node:test";
import assert from "node:assert/strict";

import { createFourByFourProvider } from "../src/scramble/wca/puzzles/444/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";

test("4x4 provider：随机状态、缓存和初始化进度", async () => {
    const provider = createFourByFourProvider();
    const progress = [];
    const init = await provider.init({ onProgress: (data) => progress.push(data) });

    assert.equal(init.randomState, true);
    assert.equal(init.algorithm, "reduction-random-state");
    assert.ok(init.tableBuildMs >= 0);
    assert.ok(progress.some((item) => item.phase === "init" && item.percent === 100));

    const scrambles = await provider.generate({ count: 2 });
    assert.equal(scrambles.length, 2);
    assert.ok(provider.meta.minLength >= 20, `长度过短: ${provider.meta.minLength}`);
    assert.ok(provider.meta.maxLength <= 80, `长度过长: ${provider.meta.maxLength}`);

    for (const text of scrambles) {
        const tokens = text.split(/\s+/).filter(Boolean);
        assert.ok(tokens.length >= 20, text);
        const validation = validateScramble("444", text);
        assert.equal(validation.ok, true, `${text} :: ${JSON.stringify(validation.errors)}`);
    }
});
