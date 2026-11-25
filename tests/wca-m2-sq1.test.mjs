import test from "node:test";
import assert from "node:assert/strict";

import {
    SQ1_MIN_SLASHES,
    applyScramble,
    countSlashes,
    cubeToString,
    getRandomSquareOneScramble,
    initTables,
    invertScramble,
    isSolvedCube,
    newCube,
    randomCube,
    solveCube,
} from "../src/scramble/wca/puzzles/sq1/sq1.js";
import { createSquareOneProvider } from "../src/scramble/wca/puzzles/sq1/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

test("Square-1 表构建 + 随机状态求解", () => {
    const tables = initTables();
    assert.ok(tables.buildMs >= 0);

    const rng = createSeededRng(20261120);
    for (let i = 0; i < 3; i++) {
        const cube = randomCube((max) => rng.nextInt(max));
        const text = solveCube(cube);
        assert.ok(text, `cube ${i} 无解`);

        const fromSolved = applyScramble(newCube(), text);
        assert.equal(cubeToString(fromSolved), cubeToString(cube), `cube ${i} 状态复现`);

        const back = applyScramble(fromSolved, invertScramble(text));
        assert.equal(isSolvedCube(back), true, `cube ${i} 逆序列`);
    }
});

test("Square-1 打乱记号：/ 与 (x,y)", () => {
    const rng = createSeededRng(777);
    for (let i = 0; i < 4; i++) {
        const text = getRandomSquareOneScramble((max) => rng.nextInt(max));
        assert.ok(text);
        assert.ok(text.includes("/"), "必须包含 /");
        assert.ok(countSlashes(text) >= SQ1_MIN_SLASHES, "至少 11 个 /");

        const validation = validateScramble("sq1", text);
        assert.equal(validation.ok, true, `${text} :: ${JSON.stringify(validation.errors)}`);
    }
});

test("Square-1 provider：随机状态打乱", async () => {
    const provider = createSquareOneProvider();
    assert.equal(provider.meta.randomState, true);
    assert.equal(provider.meta.minSlashes, SQ1_MIN_SLASHES);

    const init = await provider.init();
    assert.ok(init.tableBuildMs >= 0);

    const rng = createSeededRng(1234);
    const scrambles = await provider.generate({
        count: 3,
        options: { rng: (max) => rng.nextInt(max) },
    });

    assert.equal(scrambles.length, 3);
    assert.ok(provider.meta.minLength >= SQ1_MIN_SLASHES);
    for (const text of scrambles) {
        assert.equal(validateScramble("sq1", text).ok, true, text);
        assert.ok(countSlashes(text) >= SQ1_MIN_SLASHES, text);
    }
});
