import test from "node:test";
import assert from "node:assert/strict";

import {
    CANONICAL_STATE_COUNT,
    applyCanonicalMove,
    applyMoves,
    decodeCube,
    encodeCube,
    getCanonicalMove,
    isSolvedCube,
    movesToString,
    solvedCube,
    stringToMoves,
} from "../src/scramble/wca/puzzles/222/cubie.js";
import { getTables } from "../src/scramble/wca/puzzles/222/tables.js";
import { createTwoByTwoProvider } from "../src/scramble/wca/puzzles/222/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

test("2x2 动作模型：U^4、sexy x6、逆序列", () => {
    let state = solvedCube();
    for (let i = 0; i < 4; i++) state = applyMoves(state, [getCanonicalMove("U", 1)]);
    assert.equal(isSolvedCube(state), true);

    state = solvedCube();
    for (let i = 0; i < 6; i++) state = applyMoves(state, stringToMoves("R U R' U'"));
    assert.equal(isSolvedCube(state), true);

    const seq = stringToMoves("R U2 F' L D B2");
    const scrambled = applyMoves(solvedCube(), seq);
    assert.equal(isSolvedCube(applyMoves(scrambled, seq.slice().reverse().map((move) => getCanonicalMove(move.face, 4 - move.power)))), true);
});

test("2x2 规范坐标：编解码往返与动作表一致", () => {
    const rng = createSeededRng(20261120);
    for (let i = 0; i < 500; i++) {
        const index = rng.nextInt(CANONICAL_STATE_COUNT);
        const cube = decodeCube(index);
        assert.equal(encodeCube(cube), index);

        for (const face of ["U", "R", "F", "D", "L", "B"]) {
            for (let power = 1; power <= 3; power++) {
                const move = getCanonicalMove(face, power);
                assert.equal(
                    encodeCube(applyMoves(cube, [move])),
                    applyCanonicalMove(index, move),
                    `move ${face}${power}`
                );
            }
        }
    }
});

test("2x2 BFS：全状态覆盖、最大 11 步、最短解与打乱", async () => {
    const tables = await getTables();
    assert.equal(tables.size, CANONICAL_STATE_COUNT);
    assert.equal(tables.distance[0], 0);
    assert.equal(tables.maxDepth, 11);

    const rng = createSeededRng(12345);
    const lengths = [];
    for (let i = 0; i < 8; i++) {
        let state;
        do {
            state = rng.nextInt(CANONICAL_STATE_COUNT);
        } while (tables.distance[state] < 4);

        const solution = tables.solve(state, (max) => rng.nextInt(max));
        const scrambleMoves = solution.slice().reverse().map((move) => getCanonicalMove(move.face, 4 - move.power));
        let replay = 0;
        for (const move of scrambleMoves) replay = tables.nextState(replay, move.transformIndex);

        assert.equal(replay, state, `state ${i} 打乱复算`);
        assert.equal(tables.distance[state], scrambleMoves.length, `state ${i} 最短长度`);
        lengths.push(scrambleMoves.length);
    }
    assert.ok(Math.min(...lengths) >= 4);
    assert.ok(Math.max(...lengths) <= 11);
});

test("2x2 provider：随机状态打乱可通过规则校验", async () => {
    const provider = createTwoByTwoProvider();
    await provider.init();
    const rng = createSeededRng(777);
    const scrambles = await provider.generate({
        count: 6,
        options: { rng: (max) => rng.nextInt(max) },
    });

    assert.equal(scrambles.length, 6);
    assert.ok(provider.meta.avgLength >= 4);
    assert.ok(provider.meta.maxLength <= 11);

    for (const text of scrambles) {
        const validation = validateScramble("222", text);
        assert.equal(validation.ok, true, text);
        const moves = stringToMoves(text);
        assert.ok(moves.length >= 4, `长度过短: ${text}`);
        assert.equal(text, movesToString(moves));
    }
});
