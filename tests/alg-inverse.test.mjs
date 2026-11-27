import test from "node:test";
import assert from "node:assert/strict";

import { invertAlg } from "../src/algInverse.js";

test("公式求逆按相反顺序并翻转转动方向", () => {
    assert.equal(invertAlg("R U R' U'"), "U R U' R'");
});

test("公式求逆支持 Square-1 括号动作", () => {
    assert.equal(invertAlg("(1,0) / (0,-2)"), "(0,2) / (-1,0)");
});

test("公式求逆会把 U2' 规范成等价的 U2", () => {
    assert.equal(invertAlg("F U2' R"), "R' U2 F'");
});
