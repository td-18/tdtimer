import test from "node:test";
import assert from "node:assert/strict";

import {
    CubieCube,
    applyMoves,
    cubeCoords,
    invertMoves,
    isSolved,
    randomCube,
    simplifyMoves,
    stringToMoves,
} from "../src/scramble/wca/puzzles/333/cubie.js";
import { getTables } from "../src/scramble/wca/puzzles/333/tables.js";
import { solveCube, verifyScramble, verifySolution } from "../src/scramble/wca/puzzles/333/search.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

test("3x3 基本动作：sexy x6、U x4、逆序列", () => {
    const identity = new CubieCube();

    let sexy = identity;
    const sexyMoves = stringToMoves("R U R' U'");
    for (let i = 0; i < 6; i++) sexy = applyMoves(sexy, sexyMoves);
    assert.equal(isSolved(sexy), true);

    let u4 = identity;
    for (let i = 0; i < 4; i++) u4 = applyMoves(u4, stringToMoves("U"));
    assert.equal(isSolved(u4), true);

    const moves = stringToMoves("R U2 F' L D B2");
    const scrambled = applyMoves(identity, moves);
    assert.equal(isSolved(applyMoves(scrambled, invertMoves(moves))), true);
});

test("3x3 坐标：复原态全零", () => {
    const coords = cubeCoords(new CubieCube());
    assert.deepEqual(coords, {
        twist: 0,
        flip: 0,
        slice: 0,
        cperm: 0,
        eperm: 0,
        sperm: 0,
    });
});

test("3x3 表构建 + 随机状态求解与打乱校验", async () => {
    const tables = await getTables();
    assert.ok(tables.buildMs > 0);
    assert.ok(tables.twistSlice.length === 2187 * 495);
    assert.ok(tables.flipSlice.length === 2048 * 495);
    assert.ok(tables.cpermSperm.length === 40320 * 24);
    assert.ok(tables.epermSperm.length === 40320 * 24);

    const rng = createSeededRng(20261120);
    for (let i = 0; i < 3; i++) {
        const cube = randomCube((max) => rng.nextInt(max));
        const solution = solveCube(cube, tables, {
            maxTotal: 21,
            maxPhase1Depth: 13,
            maxPhase1Solutions: 64,
            nodeLimit: 8000000,
            timeLimitMs: 5000,
        });

        assert.ok(solution && solution.moves.length > 0, `state ${i} 无解`);
        assert.equal(verifySolution(cube, solution.moves), true, `state ${i} 解校验失败`);

        const scrambleMoves = simplifyMoves(invertMoves(solution.moves));
        assert.ok(scrambleMoves.length >= 2, `state ${i} 打乱过短`);
        assert.equal(verifyScramble(cube, scrambleMoves), true, `state ${i} 打乱校验失败`);
    }
});
