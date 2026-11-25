import test from "node:test";
import assert from "node:assert/strict";

import {
    applyAlgToFacelets,
    cubeThumbSVG,
    isTopLayerOnly,
    SOLVED_FACELETS,
    topFacePatternSVG,
} from "../src/cubeThumb.js";

function invertAlg(alg) {
    return alg
        .trim()
        .split(/\s+/)
        .reverse()
        .map((token) => {
            if (token.endsWith("2")) return token;
            if (token.endsWith("'")) return token.slice(0, -1);
            return token + "'";
        })
        .join(" ");
}

test("LSLL 贴纸模拟器：基础转动与逆序", () => {
    assert.equal(applyAlgToFacelets(""), SOLVED_FACELETS);

    const u = applyAlgToFacelets("U");
    assert.equal(u.slice(9, 12), "bbb");
    assert.equal(u.slice(18, 21), "rrr");
    assert.equal(u.slice(36, 39), "fff");
    assert.equal(u.slice(45, 48), "lll");

    assert.equal(applyAlgToFacelets("R U R' U' ".repeat(6)), SOLVED_FACELETS);
    assert.equal(applyAlgToFacelets("x x'"), SOLVED_FACELETS);
    assert.equal(applyAlgToFacelets("M M'"), SOLVED_FACELETS);

    // [U] 是注释/抵消标记，不执行。
    assert.equal(applyAlgToFacelets("U [U]"), applyAlgToFacelets("U"));
});

test("LSLL 缩略图：顶面 case 用平面图，其余用 3D 折叠", () => {
    // PLL Ua：只涉及顶层。
    const pllAlg = "R2 U' S' U2 S U' R2";
    const pllState = applyAlgToFacelets(invertAlg(pllAlg));
    assert.equal(isTopLayerOnly(pllState), true);
    assert.match(cubeThumbSVG(pllState, 64), /aria-label="LSLL 顶面状态"/);

    // ZBLS A+ EO：涉及底层/最后槽。
    const zblsAlg = "U R U' R'";
    const zblsState = applyAlgToFacelets(invertAlg(zblsAlg));
    assert.equal(isTopLayerOnly(zblsState), false);
    assert.match(cubeThumbSVG(zblsState, 64), /aria-label="LSLL 立体状态"/);
});

test("缩略图可以按分类强制平面 / 3D", () => {
    const zblsState = applyAlgToFacelets(invertAlg("U R U' R'"));
    assert.equal(isTopLayerOnly(zblsState), false);
    assert.match(cubeThumbSVG(zblsState, 64, { forceFlat: true }), /aria-label="LSLL 顶面状态"/);

    const pllState = applyAlgToFacelets(invertAlg("R2 U' S' U2 S U' R2"));
    assert.equal(isTopLayerOnly(pllState), true);
    assert.match(cubeThumbSVG(pllState, 64, { force3D: true }), /aria-label="LSLL 立体状态"/);
});

test("OLL 状态图：顶面黄色块 + 侧面贴合中心格的窄黄块", () => {
    // OLL 27（Sune）：6 个黄色顶面块 + 3 个侧面黄色块。
    const fd = applyAlgToFacelets(invertAlg("R U R' U R U2 R'"));
    const oll = topFacePatternSVG(fd, 64);
    assert.match(oll, /aria-label="OLL 状态"/);
    // 中心 9 格 + 侧面 3 个多边形（角块平行四边形 / 棱块梯形）。
    assert.equal((oll.match(/<rect /g) || []).length, 9);
    assert.equal((oll.match(/<polygon /g) || []).length, 3);
    assert.match(oll, /width="25\.00" height="25\.00"/);
    assert.match(topFacePatternSVG(fd, 64, { label: "顶面状态" }), /aria-label="顶面状态"/);
});

test("3D 缩略图可以指定未还原区域只显示黄色/深灰", () => {
    const fd = applyAlgToFacelets(invertAlg("U R U' R'"));
    const svg = cubeThumbSVG(fd, 64, {
        force3D: true,
        unsolved: (face, row, col, n) => {
            if (face === "U" || row === 0) return true;
            if (face === "F" && col === n - 1) return true;
            if (face === "R" && col === 0) return true;
            return false;
        },
    });
    assert.match(svg, /aria-label="LSLL 立体状态"/);
    // U/F/R 三面共 27 个贴纸 + 1 条外轮廓。
    assert.equal((svg.match(/<polygon /g) || []).length, 28);
    assert.match(svg, /#4d4d4d/);
    assert.match(svg, /#FFFF00/);
    // 已还原的 F2L 部分仍保留正常颜色（绿/红）。
    assert.match(svg, /#33CC33|#FF0000/);
});
