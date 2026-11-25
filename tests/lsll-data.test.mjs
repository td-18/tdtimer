import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../data/lsll.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const db = sandbox.window.LSLLDB;

test("LSLL data exposes two-step formulas and 41 one-step families", () => {
    assert.ok(db && typeof db === "object");
    assert.ok(Array.isArray(db["两步"]));
    assert.ok(Array.isArray(db["一步"]));
    assert.ok(db["两步"].length >= 795);
    assert.ok(Array.isArray(db.families));
    assert.equal(db.families.length, 41);

    const keys = new Set();
    const slugs = new Set();
    const files = new Set();
    let total = 0;
    for (const family of db.families) {
        assert.match(family.key, /^(?:[A-Z][+-]?|[STF])$/, family.key);
        assert.match(family.slug, /^[a-z]+$/, family.slug);
        assert.match(family.file, /^data\/lsll-one-step\/[a-z]+\.js$/, family.file);
        assert.ok(Number.isInteger(family.count) && family.count > 0, family.key);
        assert.match(family.facelets, /^[urfdlbo]{54}$/, family.key);
        assert.ok(!keys.has(family.key), family.key);
        assert.ok(!slugs.has(family.slug), family.slug);
        assert.ok(!files.has(family.file), family.file);
        keys.add(family.key);
        slugs.add(family.slug);
        files.add(family.file);
        total += family.count;
    }

    // 一步 LSLL 的 41 个非纯末层大类，共 579,368 条。
    assert.equal(total, 579368);
    assert.ok(!keys.has("O"));
});

test("every one-step family file matches its metadata count", () => {
    const dataSandbox = { window: {} };
    const code = db.families
        .map((family) => readFileSync(new URL("../" + family.file, import.meta.url), "utf8"))
        .join("\n");
    vm.runInNewContext(code, dataSandbox);

    const data = dataSandbox.window.LSLLOneStep;
    assert.ok(data && typeof data === "object");

    let total = 0;
    for (const family of db.families) {
        const rows = data[family.slug];
        assert.ok(Array.isArray(rows), family.slug);
        assert.equal(rows.length, family.count, family.slug);
        const caseKeys = new Set();
        for (const [name, alg] of rows) {
            assert.ok(name.startsWith(family.key + " #"), name);
            assert.ok(alg.trim().length > 0, name);
            assert.ok(!caseKeys.has(name), name);
            caseKeys.add(name);
        }
        total += rows.length;
    }
    assert.equal(total, 579368);
});

test("two-step second-look names all have ZBLL/PLL formulas", () => {
    const source = readFileSync(new URL("../data/cuberoot.js", import.meta.url), "utf8");
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    const cubeRoot = sandbox.window.CubeRootDB["3x3"];

    assert.equal(cubeRoot.ZBLL.length, 472);
    assert.equal(cubeRoot.PLL.length, 21);

    const lookup = new Map();
    for (const catKey of ["ZBLL", "PLL"]) {
        for (const [name] of cubeRoot[catKey]) {
            // PLL 分类里的 case 名不带前缀，两步数据里写作 “PLL A+” 这种形式。
            lookup.set(catKey === "PLL" ? "PLL " + name : name, catKey);
        }
    }

    const secondLook = db["两步"].filter(
        ([name]) => name.startsWith("ZBLL ") || name.startsWith("PLL ")
    );
    assert.equal(secondLook.length, 493);
    assert.equal(secondLook.filter(([name]) => name.startsWith("ZBLL ")).length, 472);
    assert.equal(secondLook.filter(([name]) => name.startsWith("PLL ")).length, 21);
    // secondLook 来自 vm realm，先转成主 realm 的数组，避免 deepEqual 比较原型。
    const missing = Array.from(secondLook, ([name]) => name).filter(
        (name) => !lookup.has(name)
    );
    assert.deepEqual(missing, [], `缺少公式：${missing.join(", ")}`);
    for (const [name, alg] of secondLook) {
        assert.ok(alg.trim().length > 0, name);
        assert.doesNotMatch(alg, /[RL]3'?/, name);
    }
});
