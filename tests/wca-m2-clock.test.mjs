import test from "node:test";
import assert from "node:assert/strict";

import {
    DIAL_COUNT,
    STATE_COUNT,
    applyMove,
    applyScramble,
    applySolution,
    generateClockScramble,
    isSolvedState,
    solveClock,
    solvedState,
} from "../src/scramble/wca/puzzles/clock/clock.js";
import { createClockProvider } from "../src/scramble/wca/puzzles/clock/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { invertAlg, validateToken } from "../src/scramble/wca/notation.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

function eqArray(actual, expected, label) {
    assert.equal(actual.length, expected.length, `${label} length`);
    for (let i = 0; i < expected.length; i++) {
        assert.equal(actual[i] % 12, expected[i] % 12, `${label}[${i}]`);
    }
}

test("Clock 状态模型：12 次动作回到原状态", () => {
    for (let move = 0; move < 18; move++) {
        let state = solvedState();
        for (let i = 0; i < 12; i++) state = applyMove(state, move, 1);
        assert.equal(isSolvedState(state), true, `move ${move}^12`);
    }
});

test("Clock 线性代数分解：从复原态复现随机状态", () => {
    const rng = createSeededRng(20261120);
    for (let i = 0; i < 40; i++) {
        const state = Array.from({ length: DIAL_COUNT }, () => rng.nextInt(12));
        const solution = new Array(18).fill(0);
        const nonZero = solveClock(state, solution);
        assert.ok(nonZero >= 0, `state ${i} 无解`);
        eqArray(applySolution(solvedState(), solution), state, `state ${i}`);
    }
});

test("Clock 记法：引脚、y2、求逆", () => {
    assert.equal(validateToken("UR5+", "clock").ok, true);
    assert.equal(validateToken("ALL12-", "clock").ok, true);
    assert.equal(validateToken("y2", "clock").ok, true);
    assert.equal(validateToken("UR", "clock").ok, true);
    assert.equal(validateToken("DR", "clock").ok, true);
    assert.equal(validateToken("URX", "clock").ok, false);

    assert.equal(invertAlg("UR5+ DR1- y2 UR DL", "clock"), "DL UR y2 DR1+ UR5-");
});

test("Clock 打乱文本可以复现生成状态", () => {
    const rng = createSeededRng(777);
    for (let i = 0; i < 6; i++) {
        const result = generateClockScramble((max) => rng.nextInt(max));
        assert.ok(result, `scramble ${i}`);
        const validation = validateScramble("clock", result.text);
        assert.equal(validation.ok, true, result.text);
        assert.ok(result.text.includes("y2"), "必须包含 y2");
        assert.ok(result.nonZero >= 2, "至少两个非零动作");
        eqArray(applyScramble(solvedState(), result.text), result.state, `scramble ${i} replay`);
    }
});

test("Clock provider：随机状态打乱", async () => {
    const provider = createClockProvider();
    assert.equal(provider.meta.randomState, true);
    assert.equal(provider.meta.stateCount, STATE_COUNT);
    assert.equal(provider.meta.algorithm, "linear-algebra-random-state");

    const rng = createSeededRng(1234);
    const scrambles = await provider.generate({
        count: 5,
        options: { rng: (max) => rng.nextInt(max) },
    });

    assert.equal(scrambles.length, 5);
    assert.ok(provider.meta.minLength >= 2);
    for (const text of scrambles) {
        assert.equal(validateScramble("clock", text).ok, true, text);
    }
});
