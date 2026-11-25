// 公式库项目元数据与「仅用于展示」的记法转换。
//
// 重要：这里不修改 window.FormulaDB / data/cuberoot.js 中的原始公式。
// CubeRoot 各项目使用自己的记法（例如 SQ1 的 (1,0)/、五魔方的 R-、斜转的 S/H），
// 展示或训练时才转换成 cubing.js / twisty-player 能接受的写法；
// 转换不了的公式由展示层给出提示，而不是写回数据。

export const PUZZLE_META = {
    "3x3": { title: "三阶公式库", short: "三阶", twisty: "3x3x3" },
    "2x2": { title: "二阶公式库", short: "二阶", twisty: "2x2x2" },
    "4x4": { title: "四阶公式库", short: "四阶", twisty: "4x4x4" },
    "5x5": { title: "五阶公式库", short: "五阶", twisty: "5x5x5" },
    "6x6": { title: "六阶公式库", short: "六阶", twisty: "6x6x6" },
    "fto": { title: "FTO 公式库", short: "FTO", twisty: "fto" },
    "megaminx": { title: "五魔方公式库", short: "五魔方", twisty: "megaminx" },
    "pyraminx": { title: "金字塔公式库", short: "金字塔", twisty: "pyraminx" },
    "skewb": { title: "斜转公式库", short: "斜转", twisty: "skewb" },
    "sq1": { title: "SQ1 公式库", short: "SQ1", twisty: "square1" },
};

export function getPuzzleMeta(puzzleKey) {
    return PUZZLE_META[puzzleKey] || {
        title: puzzleKey + " 公式库",
        short: puzzleKey,
        twisty: puzzleKey === "2x2" ? "2x2x2" : "3x3x3",
    };
}

export function getTwistyPuzzle(puzzleKey) {
    return getPuzzleMeta(puzzleKey).twisty;
}

// 斜转 Sarah's Advanced 里的 S / H 是固定触发式，不是单个转动。
// 下面映射表来自 CubeRoot 前端的斜转记法转换：
//   小写 r/l/b/d/f -> R/L/B/D/D，大写 R/L -> UR/UL，B -> U
//   S = F' L F L' 系，H = L F' L' F 系
// 展开后 cubing.js 的 skewb 能直接识别（支持 UL / UR）。
const SKEWB_TOKEN_MAP = {
    F: "F",
    B: "U",
    r: "R",
    l: "L",
    b: "B",
    d: "D",
    f: "D",
    L: "UL",
    R: "UR",
};

const SKEWB_TRIGGERS = {
    S: {
        plain: "F' L F L'",
        prime: "L F' L' F",
        double: "F' L F L' F' L F L'",
    },
    H: {
        plain: "L F' L' F",
        prime: "F' L F L'",
        double: "L F' L' F L F' L' F",
    },
};

function expandSkewbToken(token) {
    const m = token.match(/^([A-Za-z])((?:2)?'?)$/);
    if (!m) return [token];

    const letter = m[1];
    const suffix = m[2];

    const trigger = SKEWB_TRIGGERS[letter];
    if (trigger) {
        let seq;
        if (suffix === "2'") seq = trigger.prime + " " + trigger.prime;
        else if (suffix === "'") seq = trigger.prime;
        else if (suffix === "2") seq = trigger.double;
        else seq = trigger.plain;
        return seq.split(/\s+/).filter(Boolean).flatMap(expandSkewbToken);
    }

    if (Object.prototype.hasOwnProperty.call(SKEWB_TOKEN_MAP, letter)) {
        return [SKEWB_TOKEN_MAP[letter] + suffix];
    }
    return [token];
}

function expandSkewb(alg) {
    return alg.split(/\s+/).flatMap(expandSkewbToken).join(" ");
}

// CubeRoot / SpeedCubeDB 的 SQ1 记法有时省略括号，或是紧凑写法：
//   1,0 / -1,0      -> (1,0) / (-1,0)
//   /3,0/-1,1       -> / (3,0) / (-1,1)
function normalizeSquare1(alg) {
    let s = alg.replace(/\s+/g, " ").trim();
    s = s.replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, "($1,$2)");
    s = s.replace(/(^|[\s/])(-?\d+)\s*,\s*(-?\d+)(?=[\s/]|$)/g, "$1($2,$3)");
    s = s.replace(/\s*\/\s*/g, " / ");
    // 个别源数据末尾只写了单个数字（漏了第二个数），按 (n,0) 兜底
    s = s.replace(/\/\s*(-?\d+)\s*$/, "/ ($1,0)");
    return s.replace(/\s+/g, " ").trim();
}

// 五魔方部分公式用 R- / L- / D- 表示逆时针单步，转成 cubing.js 的 R' 形式。
function normalizeMegaminx(alg) {
    return alg.replace(/(^|\s)([A-Za-z]+)-/g, "$1$2'");
}

// 返回只用于 3D 展示/训练的公式字符串。原始数据保持只读。
export function normalizeFormulaAlg(puzzleKey, alg) {
    let out = String(alg == null ? "" : alg)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2191\u2193\u00b7]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!out) return "";

    if (puzzleKey === "sq1") out = normalizeSquare1(out);
    else if (puzzleKey === "megaminx") out = normalizeMegaminx(out);
    else if (puzzleKey === "skewb") out = expandSkewb(out);

    // 仅四阶循环的项目可以把 2' 当作 2；斜转/金字塔/五魔方等转数阶数不同，不能替换。
    if (["2x2", "3x3", "4x4", "5x5", "6x6"].indexOf(puzzleKey) !== -1) {
        out = out.replace(/2'/g, "2");
    }
    return out.trim();
}

// 训练时只有 2x2 / 3x3 需要随机 AUF；其他项目的顶层转法或记法不同，不强行加 AUF。
export function supportsRandomAUF(puzzleKey) {
    return puzzleKey === "3x3" || puzzleKey === "2x2";
}
