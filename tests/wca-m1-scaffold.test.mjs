import test from "node:test";
import assert from "node:assert/strict";

import {
    LOCAL_STATUS,
    getEvent,
    getScrambler,
} from "../src/scramble/wca/events.js";
import {
    clearProviders,
    getProvider,
    listProviders,
} from "../src/scramble/wca/providers.js";
import { registerBuiltinProviders } from "../src/scramble/wca/puzzles/index.js";
import { createScaffoldProvider } from "../src/scramble/wca/puzzles/scaffold.js";
import { ERROR_CODES } from "../src/scramble/wca/protocol.js";

function registerAll() {
    clearProviders();
    registerBuiltinProviders();
}

test("provider 注册表覆盖 M1/M2/M3/M4 全部本地项目", () => {
    registerAll();
    assert.deepEqual(
        listProviders().sort(),
        ["222", "333", "444", "555", "666", "777", "clock", "minx", "pyra", "skewb", "sq1"]
    );

    for (const id of ["333", "222", "444", "pyra", "skewb", "clock", "sq1", "555", "666", "777", "minx"]) {
        const provider = getProvider(id);
        assert.ok(provider, `${id} provider`);
        assert.equal(provider.meta && provider.meta.scaffold, undefined, `${id} 不应是占位`);
    }
});

test("事件注册表状态：M1/M2/M3/M4 本地项目 ready", () => {
    assert.equal(getScrambler("222").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("pyra").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("skewb").local, LOCAL_STATUS.READY);

    assert.equal(getScrambler("clock").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("sq1").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("555").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("666").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("777").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("minx").local, LOCAL_STATUS.READY);

    assert.equal(getScrambler("444").local, LOCAL_STATUS.READY);
    assert.equal(getScrambler("fto").local, LOCAL_STATUS.RESERVED);

    assert.equal(getEvent("pyra").legacyEventId, "pyram");
    assert.equal(getEvent("clock").scrambler, "clock");
    assert.equal(getEvent("sq1").requireSlash, true);
});

test("scaffold 工厂仍可用于未来预留项目", async () => {
    const provider = createScaffoldProvider({
        algorithm: "future-puzzle",
        milestone: "M6",
        note: "future puzzle",
    });
    const init = await provider.init();
    assert.equal(init.scaffold, true);
    assert.equal(init.milestone, "M6");
    await assert.rejects(
        () => provider.generate({ count: 1 }),
        (error) => error.code === ERROR_CODES.DELEGATE_LEGACY
    );
});
