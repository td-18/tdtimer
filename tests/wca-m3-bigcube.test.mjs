import test from "node:test";
import assert from "node:assert/strict";

import {
    BIG_CUBE_CONFIG,
    generateBigCubeScramble,
} from "../src/scramble/wca/puzzles/bigcube/random.js";
import { createFiveByFiveProvider } from "../src/scramble/wca/puzzles/555/provider.js";
import { createSixBySixProvider } from "../src/scramble/wca/puzzles/666/provider.js";
import { createSevenBySevenProvider } from "../src/scramble/wca/puzzles/777/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { ERROR_CODES } from "../src/scramble/wca/protocol.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

const AXIS = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const TOKEN_RE = /^(?:\d+)?([URFDLB])w?(?:\d|')?$/;

function faceAxis(token) {
    const match = TOKEN_RE.exec(token);
    if (!match) throw new Error(`无法解析大魔方动作: ${token}`);
    return AXIS[match[1]];
}

test("大魔方随机转动：步数、记法和同轴过滤", () => {
    const rng = createSeededRng(20261120);
    for (const eventId of ["555", "666", "777"]) {
        const config = BIG_CUBE_CONFIG[eventId];
        const text = generateBigCubeScramble(config, (max) => rng.nextInt(max));
        const tokens = text.split(/\s+/);
        assert.equal(tokens.length, config.moves);

        let previousAxis = -1;
        for (const token of tokens) {
            const axis = faceAxis(token);
            assert.notEqual(axis, previousAxis, `连续同轴: ${token}`);
            previousAxis = axis;
        }

        const validation = validateScramble(eventId, text);
        assert.equal(validation.ok, true, `${eventId}: ${JSON.stringify(validation.errors)}`);
        assert.ok(validation.warnings.some((item) => item.code === "RANDOM_MOVE_SCRAMBLE"));
    }
});

test("M3 provider：5x5 / 6x6 / 7x7 输出正确步数", async () => {
    const rng = createSeededRng(777);
    const cases = [
        ["555", createFiveByFiveProvider, 60],
        ["666", createSixBySixProvider, 80],
        ["777", createSevenBySevenProvider, 100],
    ];

    for (const [eventId, factory, moveCount] of cases) {
        const provider = factory();
        assert.equal(provider.meta.algorithm, "random-move");
        assert.equal(provider.meta.moveCount, moveCount);

        const scrambles = await provider.generate({
            count: 3,
            options: { rng: (max) => rng.nextInt(max) },
        });
        assert.equal(scrambles.length, 3);
        for (const text of scrambles) {
            assert.equal(text.split(/\s+/).length, moveCount);
            assert.equal(validateScramble(eventId, text).ok, true, text);
        }
    }
});

test("5BLD 仍委托 legacy 随机朝向", async () => {
    const provider = createFiveByFiveProvider();
    await assert.rejects(
        () => provider.generate({
            event: { id: "555bf", randomOrientation: true },
            count: 1,
        }),
        (error) => error.code === ERROR_CODES.DELEGATE_LEGACY
    );
});
