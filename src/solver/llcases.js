// 顶层状态类别
//
// “目标”不再由某一条公式固定：一条公式只对应一个状态，
// 而这里按类别（OLL / PLL / COLL / ELL）随机抽一个成员。
//
// 所有状态都建立在“F2L 已完成”的前提下，只动 4 个顶层角块和 4 个顶层棱块：
//   角槽 0..3 = URF UFL ULB UBR
//   棱槽 0..3 = UR  UF  UL  UB
//
// 类别定义（按“到达这一类状态”理解）：
//   OLL  顶层未完全定向（角或棱有翻转）
//   PLL  顶层已定向（角、棱朝向全 0），排列任意
//   COLL 角已解决（位置 + 朝向）且棱已定向，棱排列任意
//   ELL  角已解决，棱任意（含未定向）

import { CubieCube, permutationParity } from "../scramble/wca/puzzles/333/cubie.js";

export const CLASSES = Object.freeze(["OLL", "PLL", "COLL", "ELL"]);

const CORNER_SLOTS = [0, 1, 2, 3];
const EDGE_SLOTS = [0, 1, 2, 3];

function randomInt(rng, n) {
    return Math.floor(rng() * n) % n;
}

function shuffle(rng, size = 4) {
    const items = Array.from({ length: size }, (_, index) => index);
    for (let i = items.length - 1; i > 0; i--) {
        const j = randomInt(rng, i + 1);
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
    return items;
}

function swapTwo(list) {
    const next = list.slice();
    const temp = next[0];
    next[0] = next[1];
    next[1] = temp;
    return next;
}

function isIdentity(list) {
    return list.every((value, index) => value === index);
}

// 4 个角/棱的朝向：前 3 个随机，最后一个由“朝向和为零”反推
function randomCornerTwist(rng) {
    const twist = [randomInt(rng, 3), randomInt(rng, 3), randomInt(rng, 3)];
    twist.push((3 - ((twist[0] + twist[1] + twist[2]) % 3)) % 3);
    return twist;
}

function randomEdgeFlip(rng) {
    const flip = [randomInt(rng, 2), randomInt(rng, 2), randomInt(rng, 2)];
    flip.push((flip[0] ^ flip[1] ^ flip[2]) & 1);
    return flip;
}

function allZero(list) {
    return list.every((value) => value === 0);
}

// 排列奇偶性必须与另一侧一致，否则这个状态在魔方上不存在
function matchParity(permA, permB) {
    return permutationParity(permA) === permutationParity(permB) ? permB : swapTwo(permB);
}

export function makeLLState({ cperm, co, eperm, eo }) {
    const cube = new CubieCube();
    for (let i = 0; i < 4; i++) {
        cube.cp[CORNER_SLOTS[i]] = cperm[i];
        cube.co[CORNER_SLOTS[i]] = co[i];
        cube.ep[EDGE_SLOTS[i]] = eperm[i];
        cube.eo[EDGE_SLOTS[i]] = eo[i];
    }
    return cube;
}

export function matchesClass(name, cube) {
    // 先要求 F2L 完整：下两层 8 个角块 + 12 个棱块里的 8 个都必须在原位、朝向为零。
    // 少了这一步，随便一串动作打断 F2L 也会被误判成“顶层已定向”。
    for (let i = 4; i < 8; i++) {
        if (cube.cp[i] !== i || cube.co[i] !== 0) return false;
    }
    for (let i = 4; i < 12; i++) {
        if (cube.ep[i] !== i || cube.eo[i] !== 0) return false;
    }

    const co = [0, 1, 2, 3].map((i) => cube.co[i]);
    const eo = [0, 1, 2, 3].map((i) => cube.eo[i]);
    const cp = [0, 1, 2, 3].map((i) => cube.cp[i]);
    const ep = [0, 1, 2, 3].map((i) => cube.ep[i]);
    const oriented = allZero(co) && allZero(eo);
    const cornersSolved = allZero(co) && isIdentity(cp);

    switch (name) {
        case "OLL": return !oriented;
        case "PLL": return oriented && !(isIdentity(cp) && isIdentity(ep));
        case "COLL": return cornersSolved && allZero(eo) && !isIdentity(ep);
        case "ELL": return cornersSolved && !(isIdentity(ep) && allZero(eo));
        default: return false;
    }
}

export function sampleClass(name, rng = Math.random) {
    const label = String(name).toUpperCase();
    if (!CLASSES.includes(label)) throw new Error(`未知状态类别: ${name}`);

    for (let attempt = 0; attempt < 200; attempt++) {
        const cube = buildCandidate(label, rng);
        if (matchesClass(label, cube)) return { name: label, cube };
    }
    throw new Error(`抽取 ${label} 状态失败`);
}

// 成员很少的类别可以直接枚举（用于“到达该类任意成员”的一次搜索）
export function allClassMembers(name) {
    if (String(name).toUpperCase() !== "COLL") return null;
    const identity = [0, 1, 2, 3];
    const members = [];
    for (const perm of permutations(identity)) {
        if (permutationParity(perm) !== 0) continue;
        if (isIdentity(perm)) continue;
        members.push(makeLLState({ cperm: identity, co: [0, 0, 0, 0], eperm: perm, eo: [0, 0, 0, 0] }));
    }
    return members;
}

function permutations(items) {
    if (items.length <= 1) return [items];
    const result = [];
    for (let i = 0; i < items.length; i++) {
        const rest = items.slice(0, i).concat(items.slice(i + 1));
        for (const tail of permutations(rest)) result.push([items[i], ...tail]);
    }
    return result;
}

function buildCandidate(name, rng) {
    if (name === "PLL") {
        const cperm = shuffle(rng);
        const eperm = matchParity(cperm, shuffle(rng));
        return makeLLState({ cperm, co: [0, 0, 0, 0], eperm, eo: [0, 0, 0, 0] });
    }

    if (name === "OLL") {
        const cperm = shuffle(rng);
        const eperm = matchParity(cperm, shuffle(rng));
        // 至少一侧有翻转，否则是 PLL 状态
        const co = randomCornerTwist(rng);
        const eo = randomEdgeFlip(rng);
        if (allZero(co) && allZero(eo)) co[0] = 1;
        return makeLLState({ cperm, co, eperm, eo });
    }

    // COLL / ELL：角已解决，只有棱在动
    const identity = [0, 1, 2, 3];
    const eperm = matchParity(identity, shuffle(rng));
    const eo = name === "COLL" ? [0, 0, 0, 0] : randomEdgeFlip(rng);
    return makeLLState({ cperm: identity, co: [0, 0, 0, 0], eperm, eo });
}
