// 公式候选生成入口
//
// 输入一条已有公式（起点状态的来源），输出从该状态出发、到达目标状态的候选解。
// 目标默认是复原态；传入 target（一条公式）即可生成“A 状态 → B 状态”的公式。
// 每条候选都用块模型独立复核，不信任搜索自身的结果。
//
// 三条规则，按这个顺序生效：
//   1. 动作集是“允许范围”，不是“必须包含”；加面只会增加可能的解。
//   2. 但规模是 分支数^深度，超上限的族会被跳过（多族）或降长度（单族），
//      不会跑一半再悄悄截断。见 capacity.js。
//   3. “允许哪些动作”属于筛选层（filter.js），不放进动作集——
//      否则收紧动作集会连带减少搜索深度。
//
// 这一层只负责“生成 + 校验”，不做顺手度排序。

import {
    CubieCube,
    applyMoves,
    cubesEqual,
    invertMoves,
    movesToString,
} from "../scramble/wca/puzzles/333/cubie.js";
import { caseFromFormula, cubeFromValue, stateFromFormula } from "./cases.js";
import { findSolutions } from "./bidirectional.js";
import { NODE_CEILING, planSearch } from "./capacity.js";
import { DEFAULT_FACES, resolveMoveSet, simplifyToFixed } from "./moveset.js";
import {
    allClassMembers,
    sampleClass,
} from "./llcases.js";

// 常用动作族：按“人手实际会用的动作组合”划分，而不是按面数堆。
export const COMMON_FAMILIES = Object.freeze([
    Object.freeze(["R", "U", "F"]),
    Object.freeze(["L", "U", "F"]),
    Object.freeze(["R", "U", "D"]),
]);

const MIN_BUDGET_PER_SIDE = 300000;

export function generateCandidates(options = {}) {
    const startedAt = Date.now();
    const families = resolveFamilies(options);
    const requestedLength = resolveLength(options);
    const ceiling = options.nodeCeiling ?? NODE_CEILING;
    const multi = families.length > 1;
    const limit = options.limit ?? 2000;

    // 端点带类别时随机成分大，一次抽到的组合可能算不出解；
    // 允许重抽几次，避免直接返回 0 条。
    const classBased = !!(normalizeClass(options.fromClass) || normalizeClass(options.toClass));
    const maxAttempts = classBased ? Math.max(1, options.sampleAttempts ?? 5) : 1;

    let endpoints = null;
    let entry = null;
    let targetPlan = null;
    let targets = [];
    let merged = new Map();
    let runs = [];
    let effectiveLength = requestedLength;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        endpoints = resolveEndpoints(options);
        entry = endpoints.entry;
        targetPlan = endpoints.targetPlan;
        targets = targetPlan.list;

        const sourceMoves = simplifyToFixed(entry.moves);
        const sourceInverseMoves = simplifyToFixed(invertMoves(entry.moves));
        const reachesTarget = makeReaches(entry.cube, targets);

        merged = new Map();
        runs = [];
        effectiveLength = requestedLength;

        for (const faces of families) {
            // 目标是多个状态时，反向搜索的成本按目标数放大
            const targetFactor = Math.max(1, targets.length);
            let plan = planSearch(faces, requestedLength, Math.max(1, Math.floor(ceiling / targetFactor)));
            let notice = null;

            if (!plan.feasible) {
                if (multi) {
                    // 多族并集：算不动的族直接跳过，其他族仍按请求长度跑
                    runs.push({
                        faces: [...faces],
                        length: requestedLength,
                        depth: plan.depth,
                        estimatedNodes: plan.estimatedNodes,
                        skipped: true,
                        reason: `预计 ${formatNodes(plan.estimatedNodes)} > 上限 ${formatNodes(ceiling)}，最长可算 ${plan.maxLength} 步`,
                        elapsedMs: 0,
                    });
                    continue;
                }
                // 单族：没有别的选择，降到能算的长度，并如实报告
                const maxLength = Math.max(2, plan.maxLength);
                notice = `预计 ${formatNodes(plan.estimatedNodes)} > 上限 ${formatNodes(ceiling)}，已下调到 ${maxLength} 步`;
                plan = planSearch(faces, maxLength, ceiling);
                effectiveLength = Math.min(effectiveLength, maxLength);
            }

            const budget = Math.min(ceiling, Math.max(MIN_BUDGET_PER_SIDE, Math.ceil(plan.estimatedNodes * targetFactor * 1.2)));
            const runStart = Date.now();
            const result = findSolutions(entry.cube, {
                moves: resolveMoveSet(faces),
                forwardDepth: plan.depth[0],
                backwardDepth: plan.depth[1],
                maxNodesPerSide: budget,
                deadlineMs: options.deadlineMs ?? 60000,
                targets,
                onLevel: options.onLevel,
            });

            const label = faces.join("");
            for (const solution of result.solutions) {
                const moves = solution.moves;
                const text = movesToString(moves);
                const existing = merged.get(text);
                if (existing) {
                    if (!existing.foundIn.includes(label)) existing.foundIn.push(label);
                    continue;
                }
                merged.set(text, {
                    moves: text,
                    length: moves.length,
                    verified: reachesTarget(moves),
                    sameAsSource: isSameSequence(moves, sourceMoves),
                    inverseOfSource: isSameSequence(moves, sourceInverseMoves),
                    foundIn: [label],
                });
            }

            runs.push({
                faces: [...faces],
                length: plan.length,
                depth: plan.depth,
                estimatedNodes: plan.estimatedNodes,
                budgetPerSide: budget,
                ...result.stats,
                elapsedMs: Date.now() - runStart,
                ...(notice ? { reduced: true, reason: notice } : {}),
            });
        }

        if (merged.size > 0) break;
    }

    const reaches = makeReaches(entry.cube, targets);

    const candidates = [...merged.values()]
        .sort((a, b) => a.length - b.length || a.moves.localeCompare(b.moves));
    const kept = candidates.slice(0, limit);

    return {
        case: {
            source: entry.source,
            length: entry.moves.length,
            sourceClass: entry.className ?? null,
            sourceCube: entry.className ? entry.cube : null,
            target: describeTarget(options, targetPlan),
            targetClass: targetPlan.className,
            targetLabel: targetPlan.label,
            targetCube: targetPlan.className ? targets[0] : null,
            witnessLength: endpoints.witness ?? null,
            solvedBySource: reaches(entry.moves),
        },
        search: {
            requestedLength,
            length: effectiveLength,
            nodeCeiling: ceiling,
            targetCount: targets.length,
            families: runs,
        },
        stats: {
            total: candidates.length,
            kept: kept.length,
            capped: candidates.length > limit,
            verified: candidates.filter((row) => row.verified).length,
            shortest: candidates.length ? candidates[0].length : null,
            elapsedMs: Date.now() - startedAt,
        },
        candidates: kept,
    };
}

// 起点状态：
//   from  —— 直接给状态：从复原态执行这串动作后的状态
//   formula —— 给解法：案例 = 该公式的逆（库里公式的常规用法）
//
function makeReaches(cube, targets) {
    return (moves) => {
        const end = applyMoves(cube, moves);
        return targets.some((target) => cubesEqual(end, target));
    };
}

function describeTarget(options, plan) {
    const to = options.to ?? options.target;
    if (typeof to === "string" && to.trim()) return to.trim();
    if (to != null) return "直接指定状态";
    if (Array.isArray(options.targets) && options.targets.length) {
        return options.targets.length === 1 ? "指定状态" : `${options.targets.length} 个指定状态`;
    }
    return plan.label || null;
}

// 给完整解用：类别只取一个实际状态，避免把“任选一个成员”混成“全部成员”。
export function resolveStatePair(options = {}) {
    const endpoints = resolveEndpoints(options);
    const targets = endpoints.targetPlan.list;
    const rng = options.rng || Math.random;
    const index = targets.length > 1
        ? Math.min(targets.length - 1, Math.floor(rng() * targets.length))
        : 0;
    const plan = endpoints.targetPlan;
    const toSource = plan.className
        ? `${plan.className} 成员${targets.length > 1 ? `（${index + 1}/${targets.length}）` : ""}`
        : describeTarget(options, plan) || "复原态";

    return {
        fromCube: cubeFromValue(endpoints.entry.cube),
        toCube: cubeFromValue(targets[index]),
        fromSource: endpoints.entry.source || "复原态",
        toSource,
        fromClass: endpoints.entry.className ?? null,
        toClass: plan.className ?? null,
        targetCount: targets.length,
        targetIndex: index,
    };
}

// 给完整解 / DR 用：只要起点，不解析目标。
export function resolveStartState(options = {}) {
    const fromClass = normalizeClass(options.fromClass);
    const rng = options.rng || Math.random;
    const entry = fromClass
        ? {
            source: `${fromClass} 随机成员`,
            moves: [],
            cube: sampleClass(fromClass, rng).cube,
            className: fromClass,
        }
        : entryFromOptions(options);

    return {
        cube: cubeFromValue(entry.cube),
        source: entry.source || "复原态",
        className: entry.className ?? null,
    };
}

// 端点解析：起点/终点可以是“固定状态”或“类别”。
// 类别只按块坐标构造（F2L 保持完整），可达性交给上层重抽。
function resolveEndpoints(options) {
    const fromClass = normalizeClass(options.fromClass);
    const toClass = normalizeClass(options.toClass);
    const rng = options.rng || Math.random;

    const targetPlan = toClass ? classTargetPlan(toClass, rng) : resolveFixedTarget(options);
    const entry = fromClass
        ? {
            source: `${fromClass} 随机成员`,
            moves: [],
            cube: sampleClass(fromClass, rng).cube,
            className: fromClass,
        }
        : entryFromOptions(options);

    return { entry, targetPlan, witness: null };
}

function classTargetPlan(name, rng) {
    const members = allClassMembers(name);
    if (members && members.length) {
        return { list: members, label: `${name} 全部成员（${members.length}）`, className: name };
    }
    return { list: [sampleClass(name, rng).cube], label: `${name} 随机成员`, className: name };
}

function normalizeClass(value) {
    return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

function entryFromOptions(options) {
    if (options.fromCube != null) {
        return { source: "直接指定状态", moves: [], cube: cubeFromValue(options.fromCube) };
    }
    if (options.from != null && typeof options.from !== "string") {
        return { source: "直接指定状态", moves: [], cube: cubeFromValue(options.from) };
    }
    if (typeof options.from === "string") {
        const text = options.from.trim();
        if (!text) return { source: "", moves: [], cube: new CubieCube() };
        return stateFromFormula(text);
    }
    if (!options.formula) throw new Error("缺少 formula / from / fromCube / fromClass");
    return caseFromFormula(options.formula);
}

// 固定目标：复原态 / 公式 / 直接给的 CubieCube
function resolveFixedTarget(options) {
    if (Array.isArray(options.targets) && options.targets.length) {
        return {
            list: options.targets.map((target) => cubeFromValue(target)),
            label: options.targets.length === 1 ? "指定状态" : `${options.targets.length} 个指定状态`,
            className: null,
        };
    }
    if (options.toCube != null) {
        return { list: [cubeFromValue(options.toCube)], label: "直接指定状态", className: null };
    }
    const to = options.to ?? options.target;
    if (to != null && typeof to !== "string") {
        return { list: [cubeFromValue(to)], label: "直接指定状态", className: null };
    }
    if (typeof to === "string" && to.trim()) {
        return { list: [stateFromFormula(to).cube], label: to.trim(), className: null };
    }
    return { list: [new CubieCube()], label: null, className: null };
}

// 目标长度：兼容旧的 depth 写法（[前向, 反向] 直接相加）
function resolveLength(options) {
    if (Array.isArray(options.depth) && options.depth.length === 2) {
        return Math.max(2, (Number(options.depth[0]) || 0) + (Number(options.depth[1]) || 0));
    }
    return Math.max(2, Number(options.length) || 10);
}

function resolveFamilies(options) {
    const raw = options.families;
    if (Array.isArray(raw) && raw.length) {
        const seen = new Set();
        const list = [];
        for (const faces of raw) {
            const key = [...faces].join("");
            if (!faces.length || seen.has(key)) continue;
            seen.add(key);
            list.push([...faces]);
        }
        if (list.length) return list;
    }
    return [[...(options.faces || DEFAULT_FACES)]];
}

function formatNodes(value) {
    if (value >= 1e8) return `${Math.round(value / 1e7) / 10}亿`;
    if (value >= 1e4) return `${Math.round(value / 1e3) / 10}万`;
    return String(value);
}

function isSameSequence(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

// 任意起止的完整解；具体实现见 complete.js。
export { invertCube, multiplyCubes, relativeCube, solveBetween } from "./complete.js";
// DR（Domino Reduction）求解；具体实现见 dr.js。
export { DR_MAX_DEPTH, drCoords, isDR, solveToDR } from "./dr.js";
