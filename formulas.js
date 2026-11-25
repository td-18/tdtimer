// 公式数据分两层：
//   1. data/cuberoot.js —— 从 CubeRoot API 导入的全量数据（每个 case 取热度最高的公式）
//   2. 本文件 —— 手工校对过的套，同名套会整体覆盖导入数据
window.FormulaDB = window.CubeRootDB || {};
window.FormulaDB["2x2"] = window.FormulaDB["2x2"] || {};

// LSLL：两步（ZBLS + ZBLL/PLL 第二眼）与一步（全量 579,368 条最优解）。
// 一步公式按 41 个大类拆到 data/lsll-one-step/，打开公式库时按需加载。
if (window.LSLLDB) {
    window.FormulaDB["3x3"] = window.FormulaDB["3x3"] || {};
    window.FormulaDB["3x3"]["LSLL 两步"] = window.LSLLDB["两步"] || [];
    window.FormulaDB["3x3"]["LSLL 一步"] = window.LSLLDB["一步"] || [];
}

// EG1：手工校对版（2026-11 由作者逐条核对）
window.FormulaDB["2x2"]["EG1"] = [
    ["EG1 H 1", "R' F R2 U' R2 U' F U R"], ["EG1 H 2", "F' U R U' R2 F2 R U' F"], ["EG1 H 3", "R' U' R' F2 U F' R F'"], ["EG1 H 4", "R U R' F' R U R' U' R U R'"], ["EG1 H 5", "R U R' F' R U R' U' R U R'"], ["EG1 H 6", "R' F R2 U' R2 F' U' R"], ["EG1 Pi 1", "U2 F2 R U R' U2 R U R' U' F"], ["EG1 Pi 2", "U' R U' R2 F R2 U' R'"], ["EG1 Pi 3", "U' F R' F U' F2 R U R"], ["EG1 Pi 4", "R U R' U' R' F R2 U' R' U' R U R' F'"], ["EG1 Pi 5", "U F U' R U2 R' F' R U R' F'"], ["EG1 Pi 6", "F R U' R' F R U2 R' U F'"], ["EG1 U 1", "R U R' U R U' R2 F' R2 U R'"], ["EG1 U 2", "R U R' U R U' R' U R U2 R'"], ["EG1 U 3", "U F' U2 R U2 R' U2 F"], ["EG1 U 4", "R U2 R' U' R U R' U' R U' R'"], ["EG1 U 5", "U2 R' F R F' U R U' R' F R U' R'"], ["EG1 U 6", "R U R' U R U2 R'"], ["EG1 T 1", "U F R U' R2 F' R U R' F' R"], ["EG1 T 2", "U F' R' F R2 U R' U' R U R'"], ["EG1 T 3", "U2 R U' R2 F R U R U2 R'"], ["EG1 T 4", "R U R' U' R' F R F'"], ["EG1 T 5", "R U R' U' R' F R F'"], ["EG1 T 6", "U' R U' R' U2 F R U2 R' F"], ["EG1 L 1", "R U' R' U R U' R2 F' R F"], ["EG1 L 2", "U R' F R U' R' F R2 U R' F'"], ["EG1 L 3", "R' U R2 U' R2 U' F R2 U' R'"], ["EG1 L 4", "R' F R2 U R' F' R U2 R'"], ["EG1 L 5", "U R U R' F' R U R' U' F R' F' R"], ["EG1 L 6", "F' R U R' U' R' F R"], ["EG1 S 1", "U2 F' L U2 F2 R U' x'"], ["EG1 S 2", "R U R' U R U2 R'"], ["EG1 S 3", "R' U' R U' R' U2 R"], ["EG1 S 4", "R' U2 R U R' U R"], ["EG1 S 5", "U2 R U R' U R U2 R'"], ["EG1 S 6", "U2 R' U' R U' R' U2 R"], ["EG1 AS 1", "U' B U' R2 F2 U' F z2"], ["EG1 AS 2", "U R U' R' F' U' F2 R U' R'"], ["EG1 AS 3", "F' R U R' U' R U R2 F' R"], ["EG1 AS 4", "R U' R' F' U' R U R' U' F"]
];
