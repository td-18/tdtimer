import test from "node:test";
import assert from "node:assert/strict";

import {
    CubieCube,
    applyMoves,
    randomCube,
    stringToMoves,
} from "../src/scramble/wca/puzzles/333/cubie.js";
import { getTables } from "../src/scramble/wca/puzzles/333/tables.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";
import {
    DR_MAX_DEPTH,
    drCoords,
    isDR,
    solveToDR,
} from "../src/solver/dr.js";

const rng = createSeededRng(20261124);
const stateOf = (text) => applyMoves(new CubieCube(), stringToMoves(text));

test("DR 判定：复原态与半转群是 DR，普通面转不是", () => {
    assert.equal(isDR(new CubieCube()), true);
    assert.equal(isDR(stateOf("U D R2 L2 F2 B2")), true);
    assert.equal(isDR(stateOf("R")), false);
    assert.equal(isDR(stateOf("R U F")), false);
});

test("DR 求解：起点已是 DR 时返回空解", async () => {
    const cube = stateOf("U D R2 L2 F2 B2");
    const result = await solveToDR(cube, { timeLimitMs: 5000 });
    assert.equal(result.verified, true);
    assert.equal(result.alreadyDR, true);
    assert.deepEqual(result.moves, []);
    assert.equal(result.total, 0);
});

test("DR 求解：随机状态都能进入 DR 并复核", async () => {
    const tables = await getTables();
    for (let i = 0; i < 4; i++) {
        const cube = randomCube((max) => rng.nextInt(max));
        const result = await solveToDR(cube, {
            tables,
            maxSolutions: 32,
            timeLimitMs: 10000,
            nodeLimit: 20000000,
        });

        assert.equal(result.verified, true, `case ${i} 未找到 DR：${result.reason || ""}`);
        assert.ok(result.total <= DR_MAX_DEPTH, `case ${i} 步数 ${result.total}`);
        assert.ok(result.solutionCount >= 1, `case ${i} 没有候选`);

        for (const row of result.solutions) {
            const end = applyMoves(cube, row.moves);
            assert.equal(isDR(end), true, `case ${i} 候选未进入 DR`);
            assert.deepEqual(drCoords(end), { twist: 0, flip: 0, slice: 0 });
        }
    }
});

test("DR 求解：短状态给出最短解", async () => {
    const result = await solveToDR(stateOf("R"), { timeLimitMs: 5000 });
    assert.equal(result.verified, true);
    assert.ok(result.total <= 1, `R 状态的 DR 解不应超过 1 步，实际 ${result.total}`);
});

test("DR 求解：上限不够时明确失败", async () => {
    const result = await solveToDR(stateOf("R U F"), {
        maxDepth: 1,
        timeLimitMs: 5000,
    });
    assert.equal(result.verified, false);
    assert.equal(result.moves, null);
    assert.match(result.reason || "", /超过上限|没有找到/);
});
