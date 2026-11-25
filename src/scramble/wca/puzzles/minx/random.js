// Megaminx 随机转动生成器（M4）
//
// WCA 4b3e 允许 Megaminx 使用足够多的随机转动。
// 标准格式：7 行，每行 5 组 R/D（10 个 Pochmann 转动）+ 1 个 U/U'。
// 记号只使用 R++ / R-- / D++ / D-- / U / U'，与 notation.js 的 MINX_RE 一致。

export const MINX_LINES = 7;
export const MINX_PAIRS_PER_LINE = 5;
export const MINX_MOVES_PER_LINE = MINX_PAIRS_PER_LINE * 2 + 1;

function pickSign(randomInt) {
    return randomInt(2) === 0 ? "++" : "--";
}

export function generateMegaminxScramble(randomInt) {
    if (typeof randomInt !== "function") throw new TypeError("randomInt 必须是函数");

    const lines = [];
    for (let line = 0; line < MINX_LINES; line++) {
        const tokens = [];
        for (let pair = 0; pair < MINX_PAIRS_PER_LINE; pair++) {
            tokens.push(`R${pickSign(randomInt)}`);
            tokens.push(`D${pickSign(randomInt)}`);
        }
        tokens.push(randomInt(2) === 0 ? "U" : "U'");
        lines.push(tokens.join(" "));
    }
    return lines.join("\n");
}

export const MINX_MOVE_COUNT = MINX_LINES * MINX_MOVES_PER_LINE;
