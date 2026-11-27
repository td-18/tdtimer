import test from "node:test";
import assert from "node:assert/strict";

import {
    applyAlgToFacelets,
    applyAlgToFaceletsForPuzzle,
    cubeNetFaces,
    cubeNetSVG,
    SOLVED_FACELETS,
} from "../src/cubeThumb.js";

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

test("六阶三层宽转固定从外层开始", () => {
    const faces = cubeNetFaces(applyAlgToFaceletsForPuzzle("6x6", "3Rw"));
    assert.deepEqual(faces, [
        "uuufff".repeat(6),
        "rrrrrr".repeat(6),
        "fffddd".repeat(6),
        "dddbbb".repeat(6),
        "llllll".repeat(6),
        "uuubbb".repeat(6),
    ]);
});

test("七阶三层宽转固定从外层开始", () => {
    const faces = cubeNetFaces(applyAlgToFaceletsForPuzzle("7x7", "3Rw"));
    assert.deepEqual(faces, [
        "uuuufff".repeat(7),
        "rrrrrrr".repeat(7),
        "ffffddd".repeat(7),
        "ddddbbb".repeat(7),
        "lllllll".repeat(7),
        "uuubbbb".repeat(7),
    ]);
});

test("六阶混合宽层与内层打乱与 cubing.js 参考状态一致", () => {
    const alg = "3Rw Uw 2F 3Bw R2 3Dw Lw 3U 2B2 Fw 3Lw Dw2";
    assert.deepEqual(cubeNetFaces(applyAlgToFaceletsForPuzzle("6x6", alg)), [
        "ffurrbffuluullrrrbuuuffllluduufdubuu",
        "lldrlrlldrlrfluublflfdbudrdfrrdrdfrr",
        "ufrdbbbubdbbrfrdrrllfrrrbbbfffbbbfff",
        "rrrlllufrbbbbrbllldrduuudduflfdddflf",
        "llbbbrffldddllbfbdldlduufdfdbullfdru",
        "duufuuduurrubbbluubbblffdddfrrdddrbb",
    ]);
});
