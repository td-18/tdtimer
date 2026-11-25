// DR（Domino Reduction）求解
//
// DR 等价于 Kociemba 的 G1：角朝向、棱朝向全为 0，且 E-slice 四条棱都在
// 中间层。到达 DR 后，剩下的状态可以只用 <U, D, R2, L2, F2, B2> 解决。
// 这里只负责“任意状态 → 任意一个 DR 状态”，不继续解完魔方。
//
// 搜索复用 333 二阶段求解器的 Phase 1：从启发式下界开始逐层加深，
// 第一层有解就是最短 DR 解；每条解都用块模型重新复核。

import {
    applyMoves,
    cubeCoords,
    movesToString,
} from "../scramble/wca/puzzles/333/cubie.js";
import { findPhase1Solutions } from "../scramble/wca/puzzles/333/search.js";
import { getTables } from "../scramble/wca/puzzles/333/tables.js";
import { cubeFromValue } from "./cases.js";
import { simplifyToFixed } from "./moveset.js";

export const DR_MAX_DEPTH = 13;

function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function drCoords(cube) {
    const coords = cubeCoords(cube);
    return {
        twist: coords.twist,
        flip: coords.flip,
        slice: coords.slice,
    };
}

export function isDR(cube) {
    const coords = drCoords(cube);
    return coords.twist === 0 && coords.flip === 0 && coords.slice === 0;
}

function heuristic(coords, tables) {
    const twistSlice = tables.twistSlice[coords.twist * 495 + coords.slice];
    const flipSlice = tables.flipSlice[coords.flip * 495 + coords.slice];
    return twistSlice > flipSlice ? twistSlice : flipSlice;
}

export async function solveToDR(start, options = {}) {
    const startedAt = now();
    const fromCube = cubeFromValue(start);
    const startCoords = drCoords(fromCube);

    if (isDR(fromCube)) {
        return {
            fromCube,
            moves: [],
            text: "",
            total: 0,
            verified: true,
            alreadyDR: true,
            bestDepth: 0,
            solutions: [{ moves: [], text: "", total: 0, verified: true }],
            solutionCount: 1,
            truncated: false,
            nodes: 0,
            elapsedMs: now() - startedAt,
            reason: null,
        };
    }

    const tables = options.tables || await getTables(options.onProgress);
    const maxDepth = Math.min(DR_MAX_DEPTH, Math.max(1, options.maxDepth ?? DR_MAX_DEPTH));
    const maxSolutions = Math.max(1, options.maxSolutions ?? 64);
    const lowerBound = heuristic(startCoords, tables);

    if (lowerBound > maxDepth) {
        return {
            fromCube,
            moves: null,
            text: "",
            total: null,
            verified: false,
            alreadyDR: false,
            bestDepth: null,
            solutions: [],
            solutionCount: 0,
            truncated: false,
            nodes: 0,
            elapsedMs: now() - startedAt,
            reason: `启发式下界 ${lowerBound} 步超过上限 ${maxDepth} 步`,
        };
    }

    const ctx = {
        nodes: 0,
        limit: options.nodeLimit ?? 20000000,
        deadline: options.timeLimitMs > 0 ? now() + options.timeLimitMs : Infinity,
        aborted: false,
    };
    const seen = new Set();
    const solutions = [];
    let bestDepth = null;
    let hitSolutionCap = false;

    for (let depth = lowerBound; depth <= maxDepth; depth++) {
        const raw = findPhase1Solutions(startCoords, depth, tables, maxSolutions, ctx);
        if (raw.length >= maxSolutions) hitSolutionCap = true;

        for (const path of raw) {
            const endCube = applyMoves(fromCube, path);
            if (!isDR(endCube)) continue;
            const moves = simplifyToFixed(path);
            const text = movesToString(moves);
            if (seen.has(text)) continue;
            seen.add(text);
            solutions.push({
                moves,
                text,
                total: moves.length,
                verified: true,
            });
        }

        if (solutions.length) {
            bestDepth = depth;
            break;
        }
        if (ctx.aborted) break;
    }

    const elapsedMs = now() - startedAt;
    if (!solutions.length) {
        return {
            fromCube,
            moves: null,
            text: "",
            total: null,
            verified: false,
            alreadyDR: false,
            bestDepth: null,
            solutions: [],
            solutionCount: 0,
            truncated: ctx.aborted,
            nodes: ctx.nodes,
            elapsedMs,
            reason: ctx.aborted
                ? "搜索在节点 / 时间预算内没有完成"
                : `在 ${maxDepth} 步内没有找到 DR 解`,
        };
    }

    solutions.sort((a, b) => a.total - b.total || a.text.localeCompare(b.text));
    const best = solutions[0];

    return {
        fromCube,
        moves: best.moves,
        text: best.text,
        total: best.total,
        verified: true,
        alreadyDR: false,
        bestDepth,
        solutions,
        solutionCount: solutions.length,
        truncated: ctx.aborted || hitSolutionCap,
        nodes: ctx.nodes,
        elapsedMs,
        reason: null,
    };
}
