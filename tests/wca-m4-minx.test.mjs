import test from "node:test";
import assert from "node:assert/strict";

import {
    MINX_LINES,
    MINX_MOVE_COUNT,
    MINX_MOVES_PER_LINE,
    generateMegaminxScramble,
} from "../src/scramble/wca/puzzles/minx/random.js";
import { createMegaminxProvider } from "../src/scramble/wca/puzzles/minx/provider.js";
import { validateScramble } from "../src/scramble/wca/rules.js";
import { createSeededRng } from "../src/scramble/wca/rng.js";

const LINE_RE = /^R(?:\+\+|--) D(?:\+\+|--) R(?:\+\+|--) D(?:\+\+|--) R(?:\+\+|--) D(?:\+\+|--) R(?:\+\+|--) D(?:\+\+|--) R(?:\+\+|--) D(?:\+\+|--) U'?$/;

test("Megaminx 随机转动：7 行 × 11 个动作", () => {
    const rng = createSeededRng(20261120);
    const text = generateMegaminxScramble((max) => rng.nextInt(max));
    const lines = text.split("\n");
    assert.equal(lines.length, MINX_LINES);

    for (const line of lines) {
        const tokens = line.split(" ");
        assert.equal(tokens.length, MINX_MOVES_PER_LINE);
        assert.match(line, LINE_RE);
    }

    const validation = validateScramble("minx", text);
    assert.equal(validation.ok, true, JSON.stringify(validation.errors));
    assert.equal(text.split(/\s+/).filter(Boolean).length, MINX_MOVE_COUNT);
});

test("Megaminx provider：随机转动输出", async () => {
    const provider = createMegaminxProvider();
    assert.equal(provider.meta.algorithm, "random-move");
    assert.equal(provider.meta.moveCount, MINX_MOVE_COUNT);

    const rng = createSeededRng(777);
    const scrambles = await provider.generate({
        count: 3,
        options: { rng: (max) => rng.nextInt(max) },
    });

    assert.equal(scrambles.length, 3);
    for (const text of scrambles) {
        assert.equal(text.split("\n").length, MINX_LINES);
        assert.equal(validateScramble("minx", text).ok, true, text);
    }
});
