// WCA 记法工具（M0）
//
// 只做“解析 / 求逆 / 基础校验 / 同面合并”，不负责求解。
// 不同项目记法差异很大，这里按 scrambler id 分派：
//   333/444/555/666/777 -> 面转 + 宽转 + 整体旋转
//   pyra/skewb/fto     -> 面转（FTO 为 8 面）
//   sq1                -> (x,y) 与 /
//   clock              -> UR1+ 形式 + y2
//   minx               -> R++ / D-- / U'

const FACE_MOVE_RE = /^(?:(\d+)?)([UDLRFBudlrfb])(w?)(2'?|')?$/;
const ROTATION_RE = /^([xyz])(2'?|')?$/;
const PYRA_RE = /^[ULRBulrb]'?$/;
const SKEWB_RE = /^[ULRB]'?$/;
const FTO_RE = /^(?:U|F|R|L|B|D|BR|BL)'?$/;
const CLOCK_RE = /^(?:UR|DR|DL|UL|U|R|D|L|ALL)\d+[+-]$/;
const CLOCK_PIN_RE = /^(?:UR|DR|DL|UL)$/;
const CLOCK_ROTATION_RE = /^y2$/;
const SQ1_RE = /^\((-?\d+),\s*(-?\d+)\)$/;
const MINX_RE = /^(?:(?:R|D)(?:\+\+|--)|U'?)$/;

export function tokenize(alg) {
    return String(alg ?? "")
        .trim()
        // Square-1 常见写法是 "(0, -1)"，先把括号内空格去掉再切分
        .replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, "($1,$2)")
        .replace(/\//g, " / ")
        .split(/\s+/)
        .filter(Boolean);
}

export function parseFaceMove(token) {
    const match = FACE_MOVE_RE.exec(token);
    if (!match) return null;
    const prefix = match[1] || "";
    const face = match[2];
    const wide = match[3] || "";
    const mod = match[4] || "";
    return { prefix, face, wide, mod, base: `${prefix}${face}${wide}` };
}

export function parseRotation(token) {
    const match = ROTATION_RE.exec(token);
    if (!match) return null;
    return { prefix: "", face: match[1], wide: "", mod: match[2] || "", base: match[1] };
}

export function isFaceMoveToken(token) {
    return FACE_MOVE_RE.test(token);
}

export function isRotationToken(token) {
    return ROTATION_RE.test(token);
}

function invertMod(mod) {
    if (mod === "2" || mod === "2'") return "2";
    if (mod === "'") return "";
    return "'";
}

function movePower(mod) {
    if (mod === "2" || mod === "2'") return 2;
    if (mod === "'") return 3;
    return 1;
}

function formatFaceMove(move, power) {
    const suffix = power === 1 ? "" : power === 2 ? "2" : "'";
    return `${move.base}${suffix}`;
}

export function invertToken(token, scramblerId = "333") {
    if (scramblerId === "sq1") {
        if (token === "/") return "/";
        const match = SQ1_RE.exec(token);
        if (match) return `(${-Number(match[1])},${-Number(match[2])})`;
        return token;
    }

    if (scramblerId === "clock") {
        if (CLOCK_ROTATION_RE.test(token) || CLOCK_PIN_RE.test(token)) return token;
        if (!CLOCK_RE.test(token)) return token;
        const sign = token.endsWith("+") ? "-" : "+";
        return token.slice(0, -1) + sign;
    }

    if (scramblerId === "minx") {
        if (token === "R++") return "R--";
        if (token === "R--") return "R++";
        if (token === "D++") return "D--";
        if (token === "D--") return "D++";
        if (token === "U") return "U'";
        if (token === "U'") return "U";
        return token;
    }

    if (scramblerId === "pyra" || scramblerId === "skewb" || scramblerId === "fto") {
        return token.endsWith("'") ? token.slice(0, -1) : token + "'";
    }

    const move = parseFaceMove(token) || parseRotation(token);
    if (move) {
        return `${move.prefix}${move.face}${move.wide}${invertMod(move.mod)}`;
    }

    return token.endsWith("'") ? token.slice(0, -1) : token + "'";
}

export function invertAlg(alg, scramblerId = "333") {
    return tokenize(alg)
        .slice()
        .reverse()
        .map((token) => invertToken(token, scramblerId))
        .join(" ");
}

// 只合并相邻的同面转动；遇到不认识的 token 会原样保留并清空待合并项。
export function simplifyFaceAlg(alg) {
    const output = [];
    let pending = null;

    const flush = () => {
        if (!pending) return;
        const power = pending.power % 4;
        if (power !== 0) output.push(formatFaceMove(pending.move, power));
        pending = null;
    };

    for (const token of tokenize(alg)) {
        const move = parseFaceMove(token) || parseRotation(token);
        if (!move) {
            flush();
            output.push(token);
            continue;
        }

        const power = movePower(move.mod);
        if (pending && pending.move.base === move.base) {
            pending.power = (pending.power + power) % 4;
            if (pending.power === 0) pending = null;
        } else {
            flush();
            pending = { move, power };
        }
    }

    flush();
    return output.join(" ");
}

export function validateToken(token, scramblerId) {
    if (!token) return { ok: false, reason: "空 token" };

    switch (scramblerId) {
        case "222":
        case "333":
        case "444":
        case "555":
        case "666":
        case "777":
            if (isFaceMoveToken(token) || isRotationToken(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 NxN 面转" };
        case "pyra":
            if (PYRA_RE.test(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 Pyraminx 记法" };
        case "skewb":
            if (SKEWB_RE.test(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 Skewb 记法" };
        case "fto":
            if (FTO_RE.test(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 FTO 记法" };
        case "sq1":
            if (token === "/" || SQ1_RE.test(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 Square-1 记法" };
        case "clock":
            if (CLOCK_RE.test(token) || CLOCK_ROTATION_RE.test(token) || CLOCK_PIN_RE.test(token)) {
                return { ok: true };
            }
            return { ok: false, reason: "不是合法的 Clock 记法" };
        case "minx":
            if (MINX_RE.test(token)) return { ok: true };
            return { ok: false, reason: "不是合法的 Megaminx 记法" };
        default:
            return { ok: false, reason: `未知 scrambler: ${scramblerId}` };
    }
}

export function validateAlg(alg, scramblerId) {
    const tokens = tokenize(alg);
    if (!tokens.length) {
        return {
            ok: false,
            tokens,
            moveCount: 0,
            errors: [{ code: "EMPTY", message: "打乱为空" }],
        };
    }

    const errors = [];
    tokens.forEach((token, index) => {
        const result = validateToken(token, scramblerId);
        if (!result.ok) {
            errors.push({
                code: "BAD_TOKEN",
                message: result.reason,
                token,
                index,
            });
        }
    });

    return {
        ok: errors.length === 0,
        tokens,
        moveCount: tokens.length,
        errors,
    };
}
