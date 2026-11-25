// 公式 -> 案例状态
//
// 约定：一条公式 F 能解开案例 C，即 apply(C, F) 复原。
// 那么 C = F⁻¹（群论上唯一），所以案例状态可以直接由公式反推，
// 不需要额外的案例数据文件。

import {
    CubieCube,
    applyMoves,
    invertMoves,
    isSolved,
    movesToString,
    stringToMoves,
} from "../scramble/wca/puzzles/333/cubie.js";

// 目前只接受 18 个面转记号（U R F D L B 及 ' 和 2）。
// 含 M/E/S、宽层（u/f/r）、转体（x/y/z）的公式会给出明确报错，
// 这些记号的归一化留给后续的记号层处理。
export function caseFromFormula(formula) {
    const moves = stringToMoves(formula);
    if (!moves.length) throw new Error("公式为空");
    const cube = applyMoves(new CubieCube(), invertMoves(moves));
    if (isSolved(cube)) throw new Error("公式是恒等变换（或可完全抵消），无法作为案例");
    return { source: movesToString(moves), moves, cube };
}

export function caseSummary(entry) {
    return {
        source: entry.source,
        length: entry.moves.length,
        solvedBySource: isSolved(applyMoves(entry.cube, entry.moves)),
    };
}

// 动作串 -> 状态。空串表示复原态，方便“任意起止”里把一端留空。
export function cubeFromText(text) {
    const source = String(text ?? "").trim();
    if (!source) return new CubieCube();
    return applyMoves(new CubieCube(), stringToMoves(source));
}

export function isCubeState(value) {
    return !!value
        && Array.isArray(value.cp) && value.cp.length === 8
        && Array.isArray(value.co) && value.co.length === 8
        && Array.isArray(value.ep) && value.ep.length === 12
        && Array.isArray(value.eo) && value.eo.length === 12;
}

// 统一端点写法：CubieCube / 动作串 / 空值（复原态）。
export function cubeFromValue(value) {
    if (isCubeState(value)) {
        const cube = new CubieCube();
        cube.copyFrom(value);
        return cube;
    }
    if (typeof value === "string") return cubeFromText(value);
    if (value == null) return new CubieCube();
    throw new Error("无法识别的状态：需要 CubieCube 或动作串");
}

// 目标状态：公式执行完所处的状态（从复原态出发）。
// 生成“A 状态 → B 状态”的公式时，B 用它来定义。
export function stateFromFormula(formula) {
    const text = String(formula ?? "").trim();
    const moves = text ? stringToMoves(text) : [];
    return { source: movesToString(moves), moves, cube: cubeFromText(text) };
}
