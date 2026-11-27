import test from "node:test";
import assert from "node:assert/strict";

import { settleWithin } from "../src/loadGuard.js";

test("资源在时限内完成时返回原结果", async () => {
    const result = await settleWithin(Promise.resolve("ready"), 50, "cubing.js");
    assert.equal(result, "ready");
});

test("资源超过时限未完成时返回可降级的超时错误", async () => {
    const never = new Promise(() => {});
    await assert.rejects(
        settleWithin(never, 10, "cubing.js"),
        (error) => error && error.code === "LOAD_TIMEOUT" && /cubing\.js/.test(error.message)
    );
});
