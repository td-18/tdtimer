// 任意起止的完整解
//
// 候选生成（bidirectional.js）只在“某个动作族 + 某个长度”内找短解，
// 两个相距较远的状态（例如两条 20 步打乱）在那个范围里本来就不相交。
// 这里负责兜底：任意合法状态 A → 任意合法状态 B 一定能给出一条完整解。
//
// 做法是复用 333 的二阶段求解器：
//   1. 求相对状态 R = B⁻¹·A；
//   2. 解 R 到复原态，得到 S = R⁻¹ = A⁻¹·B；
//   3. 把 S 作用在 A 上，必然得到 B，最后用块模型复核。
//
// 二阶段表约 10 MB，首次构建 1–2 秒，所以只在调用完整解时加载。

import {
    CubieCube,
    applyMoves,
    cubesEqual,
    movesToString,
    multiply,
} from "../scramble/wca/puzzles/333/cubie.js";
import { solveCube } from "../scramble/wca/puzzles/333/search.js";
import { getTables } from "../scramble/wca/puzzles/333/tables.js";
import { cubeFromValue } from "./cases.js";
import { simplifyToFixed } from "./moveset.js";

// 状态求逆：排列反向，角朝向取补，棱朝向自身就是逆。
export function invertCube(cube) {
    const out = new CubieCube();
    for (let i = 0; i < 8; i++) {
        const slot = cube.cp[i];
        out.cp[slot] = i;
        out.co[slot] = (3 - cube.co[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
        const slot = cube.ep[i];
        out.ep[slot] = i;
        out.eo[slot] = cube.eo[i];
    }
    return out;
}

// 状态乘法：a·b 表示先做 a 再做 b，和 applyMoves 的顺序一致。
export function multiplyCubes(a, b) {
    return multiply(a, b, new CubieCube());
}

export function relativeCube(fromCube, toCube) {
    // 要求 A·S = B，所以 S = A⁻¹·B；解 B⁻¹·A 得到的正是它。
    return multiplyCubes(invertCube(toCube), fromCube);
}

function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function searchOptions(options) {
    return {
        maxTotal: options.maxTotal ?? 21,
        maxPhase1Depth: options.maxPhase1Depth ?? 13,
        maxPhase1Solutions: options.maxPhase1Solutions ?? 64,
        nodeLimit: options.nodeLimit ?? 6000000,
        timeLimitMs: options.timeLimitMs ?? 1500,
    };
}

// 返回结构固定：失败时 moves 为 null、verified 为 false，调用方只判断 verified。
export async function solveBetween(from, to, options = {}) {
    const startedAt = now();
    const fromCube = cubeFromValue(from);
    const toCube = cubeFromValue(to);

    if (cubesEqual(fromCube, toCube)) {
        return {
            fromCube,
            toCube,
            moves: [],
            text: "",
            total: 0,
            verified: true,
            reason: null,
            elapsedMs: now() - startedAt,
        };
    }

    const tables = options.tables || await getTables(options.onProgress);
    const relative = relativeCube(fromCube, toCube);
    const solved = solveCube(relative, tables, searchOptions(options));
    const elapsedMs = now() - startedAt;

    if (!solved) {
        return {
            fromCube,
            toCube,
            moves: null,
            text: "",
            total: null,
            verified: false,
            reason: "二阶段求解在时间预算内没有返回结果",
            nodes: null,
            elapsedMs,
        };
    }

    const moves = simplifyToFixed(solved.moves);
    const endCube = applyMoves(fromCube, moves);
    const verified = cubesEqual(endCube, toCube);

    return {
        fromCube,
        toCube,
        moves,
        text: movesToString(moves),
        total: moves.length,
        verified,
        reason: verified ? null : "复核失败：解作用到起点后没有到达目标",
        phase1Length: solved.phase1Length,
        phase2Length: solved.phase2Length,
        nodes: solved.nodes,
        elapsedMs,
    };
}
