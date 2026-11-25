// 3x3 二阶段 IDA* 搜索（M1）
//
// 先枚举 phase 1 解（进入 G1），再对每个解求 phase 2 的最短归位；
// 取总长最短。M1 不做 min2phase 的 6 视图/对称压缩，先保证正确与可读。

import {
    CubieCube,
    PHASE2_MOVES,
    applyMoves,
    cubeCoords,
    cubesEqual,
    isSolved,
    simplifyMoves,
} from "./cubie.js";

function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function h1(twist, flip, slice, tables) {
    const a = tables.twistSlice[twist * 495 + slice];
    const b = tables.flipSlice[flip * 495 + slice];
    return a > b ? a : b;
}

function h2(cperm, eperm, sperm, tables) {
    const a = tables.cpermSperm[cperm * 24 + sperm];
    const b = tables.epermSperm[eperm * 24 + sperm];
    return a > b ? a : b;
}

// 同面连转 / 同轴顺序冗余过滤。face 顺序：U=0,R=1,F=2,D=3,L=4,B=5。
function redundant(lastMove, move) {
    if (lastMove < 0) return false;
    const lastFace = Math.floor(lastMove / 3);
    const face = Math.floor(move / 3);
    if (face === lastFace) return true;
    if (face % 3 === lastFace % 3 && lastFace >= face) return true;
    return false;
}

export function findPhase1Solutions(start, targetDepth, tables, maxSolutions, ctx) {
    const solutions = [];
    const path = new Array(targetDepth);

    const dfs = (twist, flip, slice, depth, lastMove) => {
        if (ctx.aborted) return;
        if (ctx.nodes++ > ctx.limit) {
            ctx.aborted = true;
            return;
        }
        if ((ctx.nodes & 8191) === 0 && now() > ctx.deadline) {
            ctx.aborted = true;
            return;
        }

        const heuristic = h1(twist, flip, slice, tables);
        if (depth + heuristic > targetDepth) return;

        if (twist === 0 && flip === 0 && slice === 0) {
            if (depth === targetDepth) solutions.push(path.slice(0, depth));
            return;
        }
        if (depth === targetDepth) return;

        for (let move = 0; move < 18; move++) {
            if (redundant(lastMove, move)) continue;
            const nextTwist = tables.twistMove[twist * 18 + move];
            const nextFlip = tables.flipMove[flip * 18 + move];
            const nextSlice = tables.sliceMove[slice * 18 + move];
            if (depth + 1 + h1(nextTwist, nextFlip, nextSlice, tables) > targetDepth) continue;

            path[depth] = move;
            dfs(nextTwist, nextFlip, nextSlice, depth + 1, move);
            if (ctx.aborted || solutions.length >= maxSolutions) return;
        }
    };

    dfs(start.twist, start.flip, start.slice, 0, -1);
    return solutions;
}

function solvePhase2(coords, tables, maxDepth, ctx) {
    const startHeuristic = h2(coords.cperm, coords.eperm, coords.sperm, tables);
    if (startHeuristic > maxDepth) return null;

    for (let bound = startHeuristic; bound <= maxDepth; bound++) {
        const path = new Array(bound);
        let foundLength = -1;

        const dfs = (cperm, eperm, sperm, depth, lastMove) => {
            if (ctx.aborted) return false;
            if (ctx.nodes++ > ctx.limit) {
                ctx.aborted = true;
                return false;
            }
            if ((ctx.nodes & 8191) === 0 && now() > ctx.deadline) {
                ctx.aborted = true;
                return false;
            }

            const heuristic = h2(cperm, eperm, sperm, tables);
            if (depth + heuristic > bound) return false;
            if (cperm === 0 && eperm === 0 && sperm === 0) {
                foundLength = depth;
                return true;
            }
            if (depth === bound) return false;

            for (let move = 0; move < 10; move++) {
                const fullMove = PHASE2_MOVES[move];
                if (redundant(lastMove, fullMove)) continue;

                const nextCperm = tables.cpermMove[cperm * 10 + move];
                const nextEperm = tables.epermMove[eperm * 10 + move];
                const nextSperm = tables.spermMove[sperm * 10 + move];
                if (depth + 1 + h2(nextCperm, nextEperm, nextSperm, tables) > bound) continue;

                path[depth] = fullMove;
                if (dfs(nextCperm, nextEperm, nextSperm, depth + 1, fullMove)) return true;
                if (ctx.aborted) return false;
            }
            return false;
        };

        if (dfs(coords.cperm, coords.eperm, coords.sperm, 0, -1)) {
            return path.slice(0, foundLength);
        }
        if (ctx.aborted) return null;
    }

    return null;
}

export function solveCube(startCube, tables, options = {}) {
    const maxTotal = options.maxTotal === undefined ? 21 : options.maxTotal;
    const maxPhase1Depth = options.maxPhase1Depth === undefined ? 13 : options.maxPhase1Depth;
    const maxPhase1Solutions = options.maxPhase1Solutions === undefined ? 64 : options.maxPhase1Solutions;
    const nodeLimit = options.nodeLimit === undefined ? 6000000 : options.nodeLimit;
    const timeLimitMs = options.timeLimitMs === undefined ? 1200 : options.timeLimitMs;

    if (isSolved(startCube)) {
        return { moves: [], total: 0, phase1Length: 0, phase2Length: 0, nodes: 0 };
    }

    const ctx = {
        nodes: 0,
        limit: nodeLimit,
        deadline: timeLimitMs > 0 ? now() + timeLimitMs : Infinity,
        aborted: false,
    };
    const start = cubeCoords(startCube);
    let bestMoves = null;
    let bestTotal = Infinity;
    let bestPhase1 = 0;
    let bestPhase2 = 0;

    const firstDepth = h1(start.twist, start.flip, start.slice, tables);
    for (let depth1 = firstDepth; depth1 <= maxPhase1Depth; depth1++) {
        if (depth1 >= bestTotal) break;

        const solutions = findPhase1Solutions(start, depth1, tables, maxPhase1Solutions, ctx);
        for (const phase1 of solutions) {
            if (ctx.aborted) break;

            const after = applyMoves(startCube, phase1);
            const coords = cubeCoords(after);
            if (coords.twist !== 0 || coords.flip !== 0 || coords.slice !== 0) continue;

            const phase2Lower = h2(coords.cperm, coords.eperm, coords.sperm, tables);
            if (depth1 + phase2Lower >= bestTotal) continue;

            // maxTotal 是“目标长度”，不是硬上限：先按目标搜，找不到再接受
            // 稍长的总解，避免随机状态直接失败。
            const maxPhase2 = Math.min(18, Math.max(0, maxTotal + 6 - depth1));
            if (phase2Lower > maxPhase2) continue;

            const phase2 = solvePhase2(coords, tables, maxPhase2, ctx);
            if (!phase2) continue;

            const combined = simplifyMoves(phase1.concat(phase2));
            if (combined.length < bestTotal) {
                bestTotal = combined.length;
                bestMoves = combined;
                bestPhase1 = phase1.length;
                bestPhase2 = phase2.length;
            }

            // 已经达到目标长度，不必再枚举更长的 phase 1
            if (bestTotal <= maxTotal) {
                return {
                    moves: bestMoves,
                    total: bestTotal,
                    phase1Length: bestPhase1,
                    phase2Length: bestPhase2,
                    nodes: ctx.nodes,
                };
            }
        }

        if (ctx.aborted) break;
    }

    return bestMoves
        ? {
            moves: bestMoves,
            total: bestTotal,
            phase1Length: bestPhase1,
            phase2Length: bestPhase2,
            nodes: ctx.nodes,
        }
        : null;
}

export function verifySolution(cube, moves) {
    return isSolved(applyMoves(cube, moves));
}

export function verifyScramble(cube, scrambleMoves) {
    return cubesEqual(applyMoves(new CubieCube(), scrambleMoves), cube);
}
