// 小魔方求解器共用的排列工具。
//
// 排列一律用 0..n-1 的数组表示，rank/unrank 采用 Lehmer code。
// 这里只服务 2x2 / Pyraminx / Skewb 这类小状态空间，O(n^2) 足够。

const FACT = [1];
for (let i = 1; i <= 16; i++) FACT[i] = FACT[i - 1] * i;

export function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 16) {
        throw new RangeError("factorial 只支持 0..16");
    }
    return FACT[n];
}

export function rankPerm(perm) {
    const n = perm.length;
    let index = 0;
    for (let i = 0; i < n; i++) {
        let smaller = 0;
        for (let j = i + 1; j < n; j++) {
            if (perm[j] < perm[i]) smaller++;
        }
        index = index * (n - i) + smaller;
    }
    return index;
}

export function unrankPerm(index, n) {
    const total = FACT[n];
    if (!Number.isInteger(index) || index < 0 || index >= total) {
        throw new RangeError(`unrankPerm: index ${index} 超出 0..${total - 1}`);
    }
    const available = new Array(n);
    for (let i = 0; i < n; i++) available[i] = i;

    const perm = new Array(n);
    let rest = index;
    for (let i = 0; i < n; i++) {
        const block = FACT[n - 1 - i];
        const digit = Math.floor(rest / block);
        rest %= block;
        perm[i] = available.splice(digit, 1)[0];
    }
    return perm;
}

export function permutationParity(perm) {
    let parity = 0;
    for (let i = 0; i < perm.length; i++) {
        for (let j = i + 1; j < perm.length; j++) {
            if (perm[j] < perm[i]) parity ^= 1;
        }
    }
    return parity;
}

// 三循环 [a,b,c] 的语义与 cstimer 的 acycle 一致：
//   new[b] = old[a], new[c] = old[b], new[a] = old[c]
export function cycle3(arr, a, b, c) {
    const tmp = arr[a];
    arr[a] = arr[c];
    arr[c] = arr[b];
    arr[b] = tmp;
}

// 把排列表旋转成逆排列：inv[perm[i]] = i
export function invertPerm(perm) {
    const inv = new Array(perm.length);
    for (let i = 0; i < perm.length; i++) inv[perm[i]] = i;
    return inv;
}

// 把 0..n-1 的数组编码成 base 进制数字串（低位在前）。
export function digitsToIndex(digits, base) {
    let index = 0;
    let scale = 1;
    for (let i = 0; i < digits.length; i++) {
        index += digits[i] * scale;
        scale *= base;
    }
    return index;
}

export function indexToDigits(index, length, base) {
    const digits = new Array(length);
    let rest = index;
    for (let i = 0; i < length; i++) {
        digits[i] = rest % base;
        rest = Math.floor(rest / base);
    }
    return digits;
}
