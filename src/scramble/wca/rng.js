// 随机源（M0）
//
// 正式打乱使用 crypto.getRandomValues；只有测试/调试才使用可复现的种子 PRNG。
// randomInt 使用拒绝采样，避免 2^32 取模带来的偏差。

const CRYPTO = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

export function randomUint32() {
    if (CRYPTO && typeof CRYPTO.getRandomValues === "function") {
        const buffer = new Uint32Array(1);
        CRYPTO.getRandomValues(buffer);
        return buffer[0];
    }
    // 没有 Web Crypto 的环境（例如部分测试环境）才走这里。
    return (Math.random() * 0x100000000) >>> 0;
}

export function randomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError("maxExclusive 必须是正整数");
    }
    if (maxExclusive > 0x100000000) {
        throw new RangeError("maxExclusive 不能超过 2^32");
    }

    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value;
    do {
        value = randomUint32();
    } while (value >= limit);
    return value % maxExclusive;
}

export function randomPick(list) {
    if (!Array.isArray(list) || list.length === 0) {
        throw new RangeError("randomPick 需要非空数组");
    }
    return list[randomInt(list.length)];
}

export function shuffleInPlace(list, intFn = randomInt) {
    if (!Array.isArray(list)) throw new TypeError("shuffleInPlace 需要数组");
    for (let i = list.length - 1; i > 0; i--) {
        const j = intFn(i + 1);
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
    }
    return list;
}

// mulberry32：仅用于测试、复现和统计脚本，不用于正式打乱。
export function createSeededRng(seed) {
    let state = (Number(seed) || 0) >>> 0;

    const nextUint32 = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0);
    };

    const nextInt = (maxExclusive) => {
        if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
            throw new RangeError("maxExclusive 必须是 1..2^32 的整数");
        }
        const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
        let value;
        do {
            value = nextUint32();
        } while (value >= limit);
        return value % maxExclusive;
    };

    const shuffle = (list) => {
        for (let i = list.length - 1; i > 0; i--) {
            const j = nextInt(i + 1);
            const tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
        return list;
    };

    const pick = (list) => list[nextInt(list.length)];

    return { nextUint32, nextInt, shuffle, pick };
}
