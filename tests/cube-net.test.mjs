import test from "node:test";
import assert from "node:assert/strict";

import { applyAlgToFacelets, cubeNetFaces, cubeNetSVG, SOLVED_FACELETS } from "../src/cubeThumb.js";

test("六面展开图读取完整的六个面状态", () => {
    assert.deepEqual(cubeNetFaces(SOLVED_FACELETS), [
        "uuuuuuuuu",
        "rrrrrrrrr",
        "fffffffff",
        "ddddddddd",
        "lllllllll",
        "bbbbbbbbb",
    ]);
});

test("六面展开图反映打乱后的各面变化", () => {
    const scrambled = applyAlgToFacelets("R");
    const faces = cubeNetFaces(scrambled);
    assert.notEqual(faces[0], "uuuuuuuuu");
    assert.notEqual(faces[2], "fffffffff");
    assert.notEqual(faces[3], "ddddddddd");
    assert.notEqual(faces[5], "bbbbbbbbb");
    assert.equal(faces[4], "lllllllll");
});

test("六面展开图 SVG 包含六个独立面", () => {
    const svg = cubeNetSVG(SOLVED_FACELETS, 240);
    assert.match(svg, /data-layout="cube-net"/);
    assert.equal((svg.match(/data-face="/g) || []).length, 6);
    assert.equal((svg.match(/<rect /g) || []).length, 54);
});
