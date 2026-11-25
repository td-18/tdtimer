import test from "node:test";
import assert from "node:assert/strict";

import {
    LOCAL_STATUS,
    RULES_VERSION,
    assertRegistry,
    getEvent,
    getScrambler,
    listOfficialEvents,
    listScramblers,
    normalizeEventId,
} from "../src/scramble/wca/events.js";
import { getRule, validateScramble, assertScramble } from "../src/scramble/wca/rules.js";
import {
    invertAlg,
    simplifyFaceAlg,
    tokenize,
    validateAlg,
    validateToken,
} from "../src/scramble/wca/notation.js";
import { createSeededRng, randomInt, shuffleInPlace } from "../src/scramble/wca/rng.js";
import {
    ERROR_CODES,
    PROTOCOL_VERSION,
    createError,
    createEvent,
    createRequest,
    createResponse,
    isEvent,
    isRequest,
    isResponse,
} from "../src/scramble/wca/protocol.js";
import {
    clearProviders,
    getProvider,
    listProviders,
    registerProvider,
    unregisterProvider,
} from "../src/scramble/wca/providers.js";

test("事件注册表结构完整", () => {
    assert.equal(assertRegistry(), true);
    assert.equal(RULES_VERSION, "2026-04-01");
    assert.equal(listOfficialEvents().length, 17);
    assert.equal(listScramblers().length, 12);
});

test("17 个官方项目齐全，FTO 为预留", () => {
    const officialIds = listOfficialEvents().map((event) => event.id).sort();
    assert.deepEqual(officialIds, [
        "222",
        "333",
        "333bf",
        "333fm",
        "333mbf",
        "333oh",
        "444",
        "444bf",
        "555",
        "555bf",
        "666",
        "777",
        "clock",
        "minx",
        "pyra",
        "skewb",
        "sq1",
    ]);

    const fto = getEvent("fto");
    assert.equal(fto.official, false);
    assert.equal(fto.availableFrom, "2027");
    assert.equal(getScrambler("fto").local, LOCAL_STATUS.RESERVED);
});

test("4x4 已接入本地随机状态求解器", () => {
    const event = getEvent("444");
    assert.equal(event.legacyEventId, "444");
    assert.equal(getScrambler(event).local, LOCAL_STATUS.READY);
    assert.equal(getScrambler(event).local, "ready");
});

test("legacy event id 映射到 cubing.js 的实际 id", () => {
    assert.equal(getEvent("pyra").legacyEventId, "pyram");
    assert.equal(getEvent("333bf").legacyEventId, "333bf");
    assert.equal(getEvent("333mbf").legacyEventId, "333mbf");
    assert.equal(getEvent("444bf").legacyEventId, "444bf");
    assert.equal(getEvent("555bf").legacyEventId, "555bf");
});

test("别名与中文名可以解析", () => {
    assert.equal(normalizeEventId("3x3"), "333");
    assert.equal(normalizeEventId("4x4"), "444");
    assert.equal(normalizeEventId("megaminx"), "minx");
    assert.equal(normalizeEventId("square-1"), "sq1");
    assert.equal(normalizeEventId("pyram"), "pyra");
    assert.equal(normalizeEventId("三阶"), "333");
    assert.equal(getEvent("五魔").id, "minx");
    assert.equal(getEvent("2x2x2").id, "222");
});

test("WCA 4b3 最小步数写入规则表", () => {
    assert.equal(getRule("222").minMoves, 4);
    assert.equal(getRule("pyra").minMoves, 6);
    assert.equal(getRule("skewb").minMoves, 7);
    assert.equal(getRule("sq1").minMoves, 11);
    assert.equal(getRule("sq1").requireSlash, true);
    assert.equal(getRule("555").randomMoves, true);
    assert.equal(getRule("minx").randomMoves, true);
    assert.equal(getRule("333bf").randomOrientation, true);
    assert.equal(getRule("333mbf").dedupe, true);
    assert.equal(getRule("333").minMoves, 2);
    assert.equal(getRule("444").randomMoves, false);
});

test("记法求逆：3x3", () => {
    assert.equal(invertAlg("R U R' U'", "333"), "U R U' R'");
    assert.equal(invertAlg("R2 U' F", "333"), "F' U R2");
    assert.equal(invertAlg("Rw 3Uw' x", "444"), "x' 3Uw Rw'");
});

test("同面合并", () => {
    assert.equal(simplifyFaceAlg("R R"), "R2");
    assert.equal(simplifyFaceAlg("R R R"), "R'");
    assert.equal(simplifyFaceAlg("R2 R2"), "");
    assert.equal(simplifyFaceAlg("R R' U U U U"), "");
    assert.equal(simplifyFaceAlg("R U R'"), "R U R'");
});

test("记法求逆：Clock / Square-1 / Megaminx", () => {
    assert.equal(invertAlg("UR5+ DR1- y2", "clock"), "y2 DR1+ UR5-");
    assert.equal(invertAlg("(1,0) / (0,-3)", "sq1"), "(0,3) / (-1,0)");
    assert.equal(invertAlg("(0, -1) / (-3, 0)", "sq1"), "(3,0) / (0,1)");
    assert.equal(invertAlg("R++ U'", "minx"), "U R--");
});

test("Square-1 括号内空格会被规范化", () => {
    assert.deepEqual(tokenize("(0, -1) / (-3, 0)"), ["(0,-1)", "/", "(-3,0)"]);
});

test("token 校验按项目分派", () => {
    assert.equal(validateToken("R2'", "333").ok, true);
    assert.equal(validateToken("F2", "222").ok, true);
    assert.equal(validateToken("Rw", "444").ok, true);
    assert.equal(validateToken("3Rw'", "555").ok, true);
    assert.equal(validateToken("u'", "pyra").ok, true);
    assert.equal(validateToken("U'", "skewb").ok, true);
    assert.equal(validateToken("BR'", "fto").ok, true);
    assert.equal(validateToken("/", "sq1").ok, true);
    assert.equal(validateToken("(1,0)", "sq1").ok, true);
    assert.equal(validateToken("(0, -1)", "sq1").ok, true);
    assert.equal(validateToken("UR5+", "clock").ok, true);
    assert.equal(validateToken("y2", "clock").ok, true);
    assert.equal(validateToken("R++", "minx").ok, true);
    assert.equal(validateToken("X", "333").ok, false);
    assert.equal(validateToken("R U", "sq1").ok, false);
});

test("3x3 结构校验与 distance 校验", () => {
    const ok = validateScramble("333", "R U R' U'");
    assert.equal(ok.ok, true);
    assert.equal(ok.meta.moveCount, 4);
    assert.equal(ok.warnings.length, 0);

    const tooShort = validateScramble("333", "R U", { distance: 1 });
    assert.equal(tooShort.ok, false);
    assert.equal(tooShort.errors[0].code, "TOO_SHORT");

    const enough = validateScramble("333", "R U", { distance: 2 });
    assert.equal(enough.ok, true);
});

test("2x2 / Pyraminx / Skewb 的 minMoves 在缺少 distance 时只给警告", () => {
    for (const eventId of ["222", "pyra", "skewb"]) {
        const result = validateScramble(eventId, "R U");
        assert.equal(result.ok, true);
        assert.ok(result.warnings.some((warning) => warning.code === "MIN_MOVES_NOT_VERIFIED"));
    }
});

test("Square-1 必须有 /", () => {
    const missing = validateScramble("sq1", "(1,0) (0,-3)");
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((error) => error.code === "MISSING_SLASH"));

    const ok = validateScramble("sq1", "(1,0) / (0,-3)");
    assert.equal(ok.ok, true);
});

test("盲拧随机朝向与随机转动只做标记", () => {
    const bld = validateScramble("333bf", "R U");
    assert.ok(bld.warnings.some((warning) => warning.code === "ORIENTATION_NOT_VERIFIED"));

    const big = validateScramble("555", "R U");
    assert.ok(big.warnings.some((warning) => warning.code === "RANDOM_MOVE_SCRAMBLE"));
});

test("空打乱与未知项目", () => {
    assert.equal(validateAlg("", "333").ok, false);
    assert.equal(validateAlg("", "333").errors[0].code, "EMPTY");

    const unknown = validateScramble("nope", "R U");
    assert.equal(unknown.ok, false);
    assert.equal(unknown.errors[0].code, "UNKNOWN_EVENT");
});

test("assertScramble 失败时抛 INVALID_SCRAMBLE", () => {
    assert.throws(
        () => assertScramble("sq1", "(1,0) (0,-3)"),
        (error) => error.code === "INVALID_SCRAMBLE" && error.details.errors.length > 0
    );
});

test("随机源：范围、边界与种子复现", () => {
    assert.equal(randomInt(1), 0);
    for (let i = 0; i < 200; i++) {
        const value = randomInt(10);
        assert.ok(value >= 0 && value < 10);
    }
    assert.throws(() => randomInt(0), /正整数/);
    assert.throws(() => randomInt(0x100000001), /2\^32/);

    const a = createSeededRng(12345);
    const b = createSeededRng(12345);
    for (let i = 0; i < 20; i++) {
        assert.equal(a.nextUint32(), b.nextUint32());
    }

    const rng = createSeededRng(7);
    for (let i = 0; i < 200; i++) {
        const value = rng.nextInt(6);
        assert.ok(value >= 0 && value < 6);
    }
});

test("shuffleInPlace 不丢元素", () => {
    const list = [1, 2, 3, 4, 5];
    shuffleInPlace(list, () => 0);
    assert.deepEqual([...list].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
});

test("协议消息形状", () => {
    const request = createRequest("generate", { event: "333" }, "r1");
    assert.equal(request.protocol, PROTOCOL_VERSION);
    assert.equal(request.kind, "request");
    assert.equal(request.id, "r1");
    assert.equal(isRequest(request), true);
    assert.equal(isResponse(request), false);

    const response = createResponse("r1", { scrambles: ["R U"] });
    assert.equal(isResponse(response), true);
    assert.equal(response.ok, true);

    const error = createError("r1", ERROR_CODES.INTERNAL, "boom", { a: 1 });
    assert.equal(error.ok, false);
    assert.equal(error.error.code, "INTERNAL");
    assert.deepEqual(error.error.details, { a: 1 });

    const progress = createEvent("r1", "progress", { percent: 50 });
    assert.equal(isEvent(progress), true);
    assert.equal(progress.data.percent, 50);

    assert.notEqual(createRequest("ping").id, createRequest("ping").id);
});

test("provider 注册表", () => {
    clearProviders();
    const provider = { generate: async () => ["R U"] };
    registerProvider("test", provider);
    assert.equal(getProvider("test"), provider);
    assert.deepEqual(listProviders(), ["test"]);
    assert.equal(unregisterProvider("test"), true);
    assert.equal(getProvider("test"), null);
    clearProviders();
    assert.throws(() => registerProvider("bad", {}), /generate/);
});
