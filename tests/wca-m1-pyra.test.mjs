import test from "node:test";
import assert from "node:assert/strict";

import {
    MOVE_VARIANTS,
    STATE_COUNT,
    applyMoves,
    decodeState,
    encodeState,
    getMove,
    isSolvedState,
    movesToString,
    nextStateFromTables,
    solvedState,
    stringToMoves,
} from "../src/scramble/wca/puzzles/pyra/cubie.js";
import { getTables } from "../src/scramble/wca/puzzles/pyra/tables.js";
import { createPyraminxProvider } from "../src/scramble/wca/puzzles/pyra/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

test("Pyraminx 动作模型：U/L/R/B 三次回到复原、逆序列", () => {
    for (let axis = 0; axis < 4; axis++) {
        let state = solvedState();
        for (let i = 0; i < 3; i++) state = applyMoves(state, [getMove("face", axis, 1)]);
        assert.equal(isSolvedState(state), true, `face ${axis}^3`);
    }

    const seq = stringToMoves("U L' R u b' B");
    const scrambled = applyMoves(solvedState(), seq);
    const inverse = seq.slice().reverse().map((move) => getMove(move.kind, move.axis, 3 - move.power));
    assert.equal(isSolvedState(applyMoves(scrambled, inverse)), true);
});

test("Pyraminx 坐标：编解码往返与动作表一致", () => {
    const rng = createSeededRng(20261120);
    for (let i = 0; i < 500; i++) {
        const index = rng.nextInt(STATE_COUNT);
        const state = decodeState(index);
        assert.equal(encodeState(state), index);

        for (const move of MOVE_VARIANTS) {
            assert.equal(
                encodeState(applyMoves(state, [move])),
                nextStateFromTables(index, move.index),
                `move ${move.token}`
            );
        }
    }
});

test("Pyraminx BFS：933,120 可达状态、最大 11 步", async () => {
    const tables = await getTables();
    assert.equal(tables.size, STATE_COUNT);
    assert.equal(tables.reachable, 933120);
    assert.equal(tables.maxDepth, 11);

    const rng = createSeededRng(12345);
    for (let i = 0; i < 8; i++) {
        let state;
        do {
            state = rng.nextInt(STATE_COUNT);
        } while (tables.distance[state] < 6);

        const solution = tables.solve(state, (max) => rng.nextInt(max));
        const scrambleMoves = solution.slice().reverse().map((move) => getMove(move.kind, move.axis, 3 - move.power));
        let replay = 0;
        for (const move of scrambleMoves) replay = tables.nextState(replay, move.index);

        assert.equal(replay, state, `state ${i} 打乱复算`);
        assert.equal(tables.distance[state], scrambleMoves.length, `state ${i} 最短长度`);
        assert.ok(scrambleMoves.length >= 6);
    }
});

test("Pyraminx provider：随机状态打乱可通过规则校验", async () => {
    const provider = createPyraminxProvider();
    await provider.init();
    const rng = createSeededRng(777);
    const scrambles = await provider.generate({
        count: 6,
        options: { rng: (max) => rng.nextInt(max) },
    });

    assert.equal(scrambles.length, 6);
    assert.ok(provider.meta.minLength >= 6);
    assert.ok(provider.meta.maxLength <= 11);

    for (const text of scrambles) {
        const validation = validateScramble("pyra", text);
        assert.equal(validation.ok, true, text);
        const moves = stringToMoves(text);
        assert.ok(moves.length >= 6, `长度过短: ${text}`);
        assert.equal(text, movesToString(moves));
    }
});
