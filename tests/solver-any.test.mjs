import test from "node:test";
import assert from "node:assert/strict";

import {
    CubieCube,
    applyMoves,
    cubesEqual,
    randomCube,
    stringToMoves,
} from "../src/scramble/wca/puzzles/333/cubie.js";
import { getTables } from "../src/scramble/wca/puzzles/333/tables.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";
import {
    generateCandidates,
    invertCube,
    multiplyCubes,
    resolveStatePair,
    solveBetween,
} from "../src/solver/index.js";

const rng = createSeededRng(20261124);
const randomState = () => randomCube((max) => rng.nextInt(max));
const stateOf = (text) => applyMoves(new CubieCube(), stringToMoves(text));

test("状态求逆：左右乘都回到复原态", () => {
    const identity = new CubieCube();
    for (let i = 0; i < 24; i++) {
        const cube = randomState();
        assert.equal(cubesEqual(multiplyCubes(cube, invertCube(cube)), identity), true, `case ${i} 右逆失败`);
        assert.equal(cubesEqual(multiplyCubes(invertCube(cube), cube), identity), true, `case ${i} 左逆失败`);
    }
});

test("任意状态完整解：随机 A→B 都能复核", async () => {
    const tables = await getTables();
    for (let i = 0; i < 3; i++) {
        const from = randomState();
        const to = randomState();
        const result = await solveBetween(from, to, {
            tables,
            maxTotal: 21,
            timeLimitMs: 5000,
        });
        assert.equal(result.verified, true, `case ${i} 未通过复核：${result.reason || ""}`);
        assert.equal(cubesEqual(applyMoves(from, result.moves), to), true, `case ${i} 终点不对`);
    }
});

test("任意状态完整解：相同状态返回空解", async () => {
    const cube = randomState();
    const result = await solveBetween(cube, cube, { timeLimitMs: 5000 });
    assert.equal(result.verified, true);
    assert.deepEqual(result.moves, []);
    assert.equal(result.total, 0);
});

test("任意状态完整解：动作串起止", async () => {
    const result = await solveBetween("R U", "F", { timeLimitMs: 5000 });
    assert.equal(result.verified, true, result.reason || "");
    assert.equal(
        cubesEqual(applyMoves(stateOf("R U"), result.moves), stateOf("F")),
        true,
        result.text,
    );
});

test("候选生成接受 CubieCube 端点", () => {
    const start = stateOf("R");
    const target = stateOf("U");
    const result = generateCandidates({
        fromCube: start,
        toCube: target,
        faces: ["R", "U", "F"],
        length: 4,
        limit: 20,
    });

    assert.ok(result.candidates.length > 0, "短距离端点没有候选");
    assert.equal(result.candidates.every((row) => row.verified), true);
    for (const row of result.candidates) {
        assert.equal(cubesEqual(applyMoves(start, stringToMoves(row.moves)), target), true);
    }
    assert.equal(result.case.target, "直接指定状态");
});

test("resolveStatePair 把动作串解析成同一对状态", () => {
    const pair = resolveStatePair({ from: "R", to: "U" });
    assert.equal(cubesEqual(pair.fromCube, stateOf("R")), true);
    assert.equal(cubesEqual(pair.toCube, stateOf("U")), true);
    assert.equal(pair.fromSource, "R");
    assert.equal(pair.toSource, "U");
});
