// 求解器自检
//
// 不依赖 Node，浏览器里直接跑。工具页和 solver.html 共用这一份，
// 避免两处断言各写一遍、改一处忘一处。
//
// 返回 [{ name, ok, detail }]，调用方负责展示。

import { generateCandidates } from "./index.js";
import { applyFilter } from "./filter.js";
import { caseFromFormula, stateFromFormula } from "./cases.js";
import { NODE_CEILING, planSearch } from "./capacity.js";
import { CLASSES, matchesClass, sampleClass } from "./llcases.js";
import { applyMoves, cubesEqual, CubieCube, stringToMoves } from "../scramble/wca/puzzles/333/cubie.js";

const CASES = [
    { id: "PLL/T", formula: "R U R' U' R' F R2 U' R' U' R U R' F'", faces: ["R", "U", "F"] },
    { id: "PLL/Rb", formula: "R' U2 R U2 R' F R U R' U' R' F' R2 U'", faces: ["R", "U", "F"] },
    { id: "PLL/L", formula: "L' U' L F L' U' L U L F' L2 U L U", faces: ["L", "U", "F"] },
];

const OLL_SOURCE = "R U R' U R U2 R'"; // OLL 27
const OLL_TARGET = "U";

function hasAdjacentSameFace(movesText) {
    const tokens = movesText.trim().split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
        if (tokens[i][0] === tokens[i - 1][0]) return true;
    }
    return false;
}

export async function runSelfTest(options = {}) {
    const onStep = options.onStep || (() => {});
    const results = [];
    const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

    // ---- 案例生成 ----
    let first = null;
    for (const item of CASES) {
        await onStep(`${item.id} 生成`);
        const run = generateCandidates({ formula: item.formula, faces: item.faces, length: 14, limit: 500 });
        if (!first) first = run;
        check(`${item.id} 有候选`, run.stats.total > 0, `${run.stats.total} 条，最短 ${run.stats.shortest ?? "-"}`);
        check(`${item.id} 全部通过校验`, run.candidates.every((row) => row.verified));
        check(`${item.id} 案例自检`, run.case.solvedBySource);
        check(`${item.id} 没有相邻同面动作`, run.candidates.every((row) => !hasAdjacentSameFace(row.moves)));
    }

    // ---- 容量上限 ----
    await onStep("容量上限");
    const wide = ["R", "U", "L", "F", "D"];
    const plan = planSearch(wide, 14);
    check("RULFD@14 判为超限", !plan.feasible, `预计 ${plan.estimatedNodes}，上限 ${NODE_CEILING}`);
    check("给出可算长度", plan.maxLength < 14, `最长 ${plan.maxLength} 步`);

    const single = generateCandidates({ formula: CASES[0].formula, faces: wide, length: 14 });
    check("单族自动降长度", single.search.length === plan.maxLength, `实际 ${single.search.length} 步`);
    check("降长度有说明", single.search.families[0].reduced === true, single.search.families[0].reason || "");

    const union = generateCandidates({
        formula: CASES[0].formula,
        families: [["R", "U", "F"], ["L", "U", "F"], ["R", "U", "D"], wide],
        length: 14,
        limit: 500,
    });
    const skipped = union.search.families.filter((run) => run.skipped);
    check("并集跳过超限族", skipped.length === 1 && skipped[0].faces.join("") === "RULFD", skipped[0]?.reason || "");
    check("并集仍有结果", union.stats.total > 0, `${union.stats.total} 条`);

    // ---- 单调性 ----
    const unionSet = new Set(union.candidates.map((row) => row.moves));
    const missing = first.candidates.filter((row) => !unionSet.has(row.moves));
    check("并集候选数不减少", union.stats.total >= first.stats.total, `${first.stats.total} → ${union.stats.total}`);
    check("单族结果全部保留", missing.length === 0, `丢失 ${missing.length} 条`);

    // ---- 筛选层 ----
    const filtered = applyFilter(union.candidates, { allowedFaces: ["R", "U", "F"] });
    check("筛选后有结果", filtered.kept.length > 0, `保留 ${filtered.kept.length} 条`);
    check("含其它面的候选被排除", filtered.rejected.length > 0, `排除 ${filtered.rejected.length} 条`);
    check("保留的候选只含允许面", filtered.kept.every((row) => !/[LD]/.test(row.moves)), "");
    check("排除都有原因", filtered.rejected.every((row) => row.reason), "");

    // ---- 目标状态 ----
    await onStep("目标状态");
    const targetRun = generateCandidates({
        formula: OLL_SOURCE,
        target: OLL_TARGET,
        faces: ["R", "U", "F"],
        length: 14,
        limit: 500,
    });
    check("目标模式有候选", targetRun.candidates.length > 0, `${targetRun.candidates.length} 条`);
    check("全部到达目标状态", targetRun.candidates.every((row) => row.verified));
    check("目标不是复原态", targetRun.case.solvedBySource === false, `来源公式到达目标 ${targetRun.case.solvedBySource}`);
    check("已知解被找到", targetRun.candidates.some((row) => row.moves === "R U R' U R U2 R' U"), "");
    check("没有把起点公式当答案", targetRun.candidates.every((row) => row.moves !== OLL_SOURCE), "");

    // ---- 自定义起止状态 ----
    await onStep("起止状态");
    const solveRun = generateCandidates({ from: OLL_SOURCE, to: "", faces: ["R", "U", "F"], length: 12 });
    check("起止模式：有候选", solveRun.candidates.length > 0, `${solveRun.candidates.length} 条`);
    check("起止模式：逆公式被找到", solveRun.candidates.some((row) => row.moves === "R U2 R' U' R U' R'"), "");
    check("起止模式：全部到达结束状态", solveRun.candidates.every((row) => row.verified), "");

    const buildRun = generateCandidates({ from: "", to: OLL_SOURCE, faces: ["R", "U", "F"], length: 12 });
    check("从复原态到指定状态", buildRun.candidates.some((row) => row.moves === OLL_SOURCE), `${buildRun.candidates.length} 条`);

    // ---- 状态类别随机 ----
    await onStep("状态类别");
    for (const name of CLASSES) {
        let allMatch = true;
        for (let i = 0; i < 12; i++) {
            if (!matchesClass(name, sampleClass(name).cube)) {
                allMatch = false;
                break;
            }
        }
        check(`${name} 抽样都符合该类`, allMatch, "12 次");
    }

    const seeded = (seed) => {
        let state = seed >>> 0;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    };
    check(
        "同一随机种子抽到同一状态",
        cubesEqual(sampleClass("PLL", seeded(7)).cube, sampleClass("PLL", seeded(7)).cube),
        "",
    );

    // 从 OLL 案例出发，目标是随机一个 PLL 状态
    const ollCase = caseFromFormula(OLL_SOURCE).cube;
    const classRun = generateCandidates({
        formula: OLL_SOURCE,
        toClass: "PLL",
        faces: ["R", "U", "F"],
        length: 14,
        limit: 50,
    });
    const classEnds = classRun.candidates.map((row) => applyMoves(ollCase, stringToMoves(row.moves)));
    check("目标类别被记录", classRun.case.targetClass === "PLL", classRun.case.targetLabel || "");
    check("抽到的目标符合类别", matchesClass("PLL", classRun.case.targetCube), "");
    check(
        "候选若存在则都到达该类别",
        classEnds.every((cube) => matchesClass("PLL", cube)),
        `${classRun.candidates.length} 条`,
    );

    const fromClassRun = generateCandidates({
        fromClass: "OLL",
        rng: seeded(11),
        faces: ["R", "U", "F"],
        length: 14,
    });
    check("随机起点类别被记录", fromClassRun.case.sourceClass === "OLL", fromClassRun.case.source || "");
    check("抽到的起点符合类别", matchesClass("OLL", fromClassRun.case.sourceCube), "");
    check("随机起点一定有解（逆在族内）", fromClassRun.candidates.length > 0, `${fromClassRun.candidates.length} 条`);

    const pairRun = generateCandidates({
        fromClass: "PLL",
        toClass: "COLL",
        faces: ["R", "U", "F"],
        length: 12,
        rng: seeded(5),
        limit: 50,
    });
    check("起止都随机时不报错", Array.isArray(pairRun.candidates), `${pairRun.candidates.length} 条，见证解 ${pairRun.case.witnessLength ?? "-"} 步`);
    check(
        "起点符合起点类别",
        matchesClass("PLL", pairRun.case.sourceCube),
        "",
    );
    check(
        "候选都到达目标类别",
        pairRun.candidates.every((row) => matchesClass("COLL", applyMoves(pairRun.case.sourceCube, stringToMoves(row.moves)))),
        "",
    );

    // ---- 类别判定必须要求 F2L 完整 ----
    await onStep("类别判定");
    const broken = applyMoves(new CubieCube(), stringToMoves("R"));
    check("F2L 被打断时不算 PLL", !matchesClass("PLL", broken), "");

    const pllCase = stateFromFormula("R U R' U' R' F R F'").cube;
    const pllRun = generateCandidates({
        from: "R U R' U' R' F R F'",
        toClass: "PLL",
        faces: ["R", "U", "F"],
        length: 12,
        rng: seeded(9),
        limit: 50,
    });
    const badEnds = pllRun.candidates.filter((row) => {
        const end = applyMoves(pllCase, stringToMoves(row.moves));
        const f2l = [4, 5, 6, 7].every((i) => end.cp[i] === i && end.co[i] === 0)
            && [4, 5, 6, 7, 8, 9, 10, 11].every((i) => end.ep[i] === i && end.eo[i] === 0);
        return !f2l || !matchesClass("PLL", end);
    });
    check("抽到的 PLL 目标 F2L 完整且已定向", matchesClass("PLL", pllRun.case.targetCube), "");
    check("PLL 候选结束后 F2L 完整且已定向", badEnds.length === 0, `${pllRun.candidates.length} 条候选`);

    // ---- 目标集合成本 ----
    await onStep("目标集合成本");
    const solvedCube = stateFromFormula("U U'").cube;
    const tCube = stateFromFormula(CASES[0].formula).cube;
    const lCube = stateFromFormula(CASES[2].formula).cube;
    const costOf = (targets) => generateCandidates({
        formula: OLL_SOURCE,
        targets,
        faces: ["R", "U", "F"],
        length: 12,
    }).search.families[0].backwardNodes;

    const one = costOf([solvedCube]);
    const two = costOf([solvedCube, tCube]);
    const three = costOf([solvedCube, tCube, lCube]);
    const projected = Math.round((three / 3) * 288);
    check("目标数增加，反向搜索近似线性", two > one * 1.5, `${one} → ${two}`);
    check("继续线性增长", three > one * 2.2, `${two} → ${three}`);
    check("288 个定向目标超过上限", projected > NODE_CEILING, `外推 ${projected} / 上限 ${NODE_CEILING}`);

    return results;
}
