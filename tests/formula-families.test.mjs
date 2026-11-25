import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { getFormulaFamilies } from "../src/formulaFamilies.js";

const source = readFileSync(new URL("../data/cuberoot.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const db = sandbox.window.CubeRootDB;

function familyMap(puzzle, cat) {
    const families = getFormulaFamilies(puzzle, cat, db[puzzle][cat]);
    return new Map(families.map((family) => [family.key, family.cases]));
}

test("ZBLL 按 AS / H / L / Pi / S / T / U 七个家族拆分", () => {
    const families = getFormulaFamilies("3x3", "ZBLL", db["3x3"].ZBLL);
    assert.deepEqual(families.map((family) => family.key), ["AS", "H", "L", "Pi", "S", "T", "U"]);
    assert.equal(families.find((family) => family.key === "AS").cases.length, 72);
    assert.equal(families.reduce((sum, family) => sum + family.cases.length, 0), 472);
});

test("COLL / CMLL / OH CMLL 使用同一套方向家族", () => {
    assert.deepEqual(
        [...familyMap("3x3", "COLL").keys()],
        ["AS", "H", "L", "Pi", "S", "T", "U"],
    );
    assert.deepEqual(
        [...familyMap("3x3", "CMLL").keys()],
        ["Anti Sune", "H", "L", "O", "Pi", "Sune", "T", "U"],
    );
    assert.deepEqual(
        [...familyMap("3x3", "OH CMLL").keys()],
        ["Antisune", "H", "L", "O", "Pi", "Sune", "T", "U"],
    );
});

test("二阶 CLL / EG / LEG-1 / LS / TCLL 按名称家族拆分", () => {
    assert.deepEqual(
        [...familyMap("2x2", "CLL").keys()],
        ["AS", "H", "L", "Pi", "Sune", "T", "U"],
    );
    assert.deepEqual(
        [...familyMap("2x2", "EG1").keys()],
        ["AS", "H", "L", "Pi", "S", "T", "U"],
    );
    assert.deepEqual(
        [...familyMap("2x2", "LEG1").keys()],
        ["Anti-Sune", "H", "L", "Pi", "Sune", "T", "U"],
    );

    const ls1 = familyMap("2x2", "LS1");
    assert.equal(ls1.size, 9);
    assert.deepEqual([...ls1.get("Antisune").map((row) => row[0])].slice(0, 2), [
        "LS-1 Antisune 1",
        "LS-1 Antisune 2",
    ]);

    const tcll = familyMap("2x2", "TCLL+");
    assert.equal(tcll.size, 8);
    assert.equal(tcll.get("Pinwheel Poser").length, 6);
    assert.equal(tcll.get("Two-Face").length, 4);
});

test("1LLL / OLLCP 按对应 OLL 编号分组", () => {
    const oneLLL = familyMap("3x3", "1LLL");
    assert.equal(oneLLL.size, 50);
    assert.equal(oneLLL.get("OLL 1").length, 40);
    assert.equal(oneLLL.get("OLL 57").length, 32);
    assert.equal(
        getFormulaFamilies("3x3", "1LLL", db["3x3"]["1LLL"])
            .reduce((sum, family) => sum + family.cases.length, 0),
        3397,
    );

    const ollcp = familyMap("3x3", "OLLCP");
    assert.equal(ollcp.size, 57);
    assert.ok([...ollcp.values()].every((cases) => cases.length === 6));
});

test("没有家族前缀的分类保持平铺（返回空数组）", () => {
    assert.deepEqual(getFormulaFamilies("3x3", "OLL", db["3x3"].OLL), []);
    assert.deepEqual(getFormulaFamilies("3x3", "PLL", db["3x3"].PLL), []);
    assert.deepEqual(getFormulaFamilies("3x3", "VLS", db["3x3"].VLS), []);
    assert.deepEqual(getFormulaFamilies("2x2", "OLL", db["2x2"].OLL), []);
});

test("所有已分组分类都不丢 case", () => {
    for (const puzzle of ["3x3", "2x2"]) {
        for (const cat of Object.keys(db[puzzle])) {
            const cases = db[puzzle][cat];
            const families = getFormulaFamilies(puzzle, cat, cases);
            if (!families.length) continue;
            const total = families.reduce((sum, family) => sum + family.cases.length, 0);
            assert.equal(total, cases.length, `${puzzle} / ${cat}`);
        }
    }
});
