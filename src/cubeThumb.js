// 公式库状态缩略图：统一使用平面色块配色。
//
// 规则（纯几何，不做美术设计）：
// - 只有顶层需要还原、下层完全不动时，画成 2D 平面十字：
//   顶面 N×N + 四周各 N 格；N 由面数自动推导（2x2 … 7x7）。
// - 其余情况把 U/F/R 三个面按等距投影折成 3D 小立方体，
//   颜色和平面图一致，不做额外的明暗/高光。
//
// 同时提供轻量 N×N 贴纸模拟器，供公式状态缩略图从 alg 直接算出 facelets。

const COLORS = {
    u: "#FFFF00",
    r: "#FF0000",
    f: "#33CC33",
    d: "#FFFFFF",
    l: "#FFA500",
    b: "#2266FF",
    o: "#A3ACB8",
};

const FACE_KEYS = ["u", "r", "f", "d", "l", "b"];

export const SOLVED_FACELETS =
    "uuuuuuuuu" + "rrrrrrrrr" + "fffffffff" + "ddddddddd" + "lllllllll" + "bbbbbbbbb";

// 公式库项目 → 阶数。未列出的项目不参与 N×N 状态计算。
const ORDER_BY_PUZZLE = {
    "2x2": 2,
    "3x3": 3,
    "4x4": 4,
    "5x5": 5,
    "6x6": 6,
    "7x7": 7,
};

// 由 facelets 长度反推阶数：6 × N²。
function orderFromFacelets(facelets) {
    const len = String(facelets || "").length;
    const n = Math.round(Math.sqrt(len / 6));
    return n >= 2 && n <= 7 && n * n * 6 === len ? n : 0;
}

// 每个面的贴纸在 3D 坐标里的位置和法向。
// 坐标取 -(N-1), -(N-3) … (N-1)，保证 90° 旋转后仍是整数。
// x: 右 + / 左 -，y: 上 + / 下 -，z: 前 + / 后 -。
function faceDefs(n) {
    const m = n - 1;
    const defs = [
        {
            key: "u",
            normal: [0, 1, 0],
            pos: (r, c) => [2 * c - m, m, 2 * r - m],
        },
        {
            key: "r",
            normal: [1, 0, 0],
            pos: (r, c) => [m, -(2 * r - m), -(2 * c - m)],
        },
        {
            key: "f",
            normal: [0, 0, 1],
            pos: (r, c) => [2 * c - m, -(2 * r - m), m],
        },
        {
            key: "d",
            normal: [0, -1, 0],
            pos: (r, c) => [2 * c - m, -m, -(2 * r - m)],
        },
        {
            key: "l",
            normal: [-1, 0, 0],
            pos: (r, c) => [-m, -(2 * r - m), 2 * c - m],
        },
        {
            key: "b",
            normal: [0, 0, -1],
            pos: (r, c) => [-(2 * c - m), -(2 * r - m), -m],
        },
    ];
    defs.forEach((def, index) => {
        def.base = index * n * n;
    });
    return defs;
}

function solvedFacelets(n) {
    return FACE_KEYS.map((key) => key.repeat(n * n)).join("");
}

const keyOf = (pos, normal) => pos.join(",") + "|" + normal.join(",");

const SLOT_CACHE = new Map();
function slotsForOrder(n) {
    if (SLOT_CACHE.has(n)) return SLOT_CACHE.get(n);
    const slots = new Map();
    const defs = faceDefs(n);
    defs.forEach((def, faceIndex) => {
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                slots.set(keyOf(def.pos(r, c), def.normal), faceIndex * n * n + r * n + c);
            }
        }
    });
    SLOT_CACHE.set(n, slots);
    return slots;
}

function rotateVec([x, y, z], axis, angle) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : Math.round(v));
    if (axis === "x") return [clean(x), clean(y * cos - z * sin), clean(y * sin + z * cos)];
    if (axis === "y") return [clean(x * cos + z * sin), clean(y), clean(-x * sin + z * cos)];
    return [clean(x * cos - y * sin), clean(x * sin + y * cos), clean(z)];
}

function stickersFromFacelets(facelets, n) {
    const fd = String(facelets || solvedFacelets(n)).padEnd(6 * n * n, "o");
    const defs = faceDefs(n);
    const stickers = [];
    defs.forEach((def, faceIndex) => {
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const index = faceIndex * n * n + r * n + c;
                stickers.push({
                    color: fd[index],
                    pos: def.pos(r, c),
                    normal: def.normal.slice(),
                });
            }
        }
    });
    return stickers;
}

function stickersToFacelets(stickers, n) {
    const out = new Array(6 * n * n).fill("o");
    const slots = slotsForOrder(n);
    for (const sticker of stickers) {
        const index = slots.get(keyOf(sticker.pos, sticker.normal));
        if (index !== undefined) out[index] = sticker.color;
    }
    return out.join("");
}

// 顺时针（从该面外侧看）90° 的轴、层和旋转角。
const FACE_MOVES = {
    U: { axis: "y", sign: 1, angle: -90 },
    D: { axis: "y", sign: -1, angle: 90 },
    R: { axis: "x", sign: 1, angle: -90 },
    L: { axis: "x", sign: -1, angle: 90 },
    F: { axis: "z", sign: 1, angle: -90 },
    B: { axis: "z", sign: -1, angle: 90 },
};

const SLICE_MOVES = {
    M: { axis: "x", angle: 90 },
    E: { axis: "y", angle: 90 },
    S: { axis: "z", angle: -90 },
};

const ROTATION_MOVES = {
    x: { axis: "x", angle: -90 },
    y: { axis: "y", angle: -90 },
    z: { axis: "z", angle: -90 },
};

function allLayerCoords(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(2 * i - (n - 1));
    return out;
}

function innerLayerCoords(n) {
    const out = [];
    for (let i = 1; i < n - 1; i++) out.push(2 * i - (n - 1));
    return out;
}

// 解析一步转动：面转 / 宽层 / 内层 / 中层 / 整体旋转。
// 支持 2R、3Rw、Rw、u、M、m、x 等记法。
function parseMove(token, n) {
    // 数据里偶见 [U] / [U2] 这种标记，它是注释/抵消提示，不参与实际转动。
    const t = String(token || "");
    if (/^\[.*\]$/.test(t)) return null;
    const m = t.match(/^(\d*)([UDLRFBudlrfbMESmesxyz])(w?)(\d*)(')?$/);
    if (!m) return null;

    const prefix = m[1];
    const letter = m[2];
    const wideFlag = m[3] === "w";
    const power = m[4] ? Number(m[4]) : 1;
    const prime = m[5] === "'";
    const turns = prime ? (4 - (power % 4)) % 4 : power % 4;
    if (!turns) return { axis: "x", layers: [], angle: 0, turns: 0 };

    if (/[xyz]/.test(letter)) {
        const rotation = ROTATION_MOVES[letter];
        return { ...rotation, layers: allLayerCoords(n), turns };
    }

    if (/[MES]/.test(letter)) {
        const upper = letter.toUpperCase();
        const slice = SLICE_MOVES[upper];
        const isLower = letter !== upper;
        const layers = (isLower || n % 2 === 0) ? innerLayerCoords(n) : [0];
        return { ...slice, layers, turns };
    }

    const face = letter.toUpperCase();
    const move = FACE_MOVES[face];
    if (!move) return null;

    const lowerCaseFace = /[udlrfb]/.test(letter);
    const wide = wideFlag || lowerCaseFace;
    const start = prefix ? Number(prefix) : 1;
    const count = wide ? (prefix ? Number(prefix) : 2) : 1;
    if (start < 1 || start + count - 1 > n) return null;

    const layers = [];
    for (let i = 0; i < count; i++) {
        layers.push(move.sign * (n + 1 - 2 * (start + i)));
    }
    return { axis: move.axis, layers, angle: move.angle, turns };
}

function applyMoveToStickers(stickers, move) {
    if (!move || !move.turns) return;
    const coordIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2;
    for (let i = 0; i < move.turns; i++) {
        for (const sticker of stickers) {
            if (move.layers.indexOf(sticker.pos[coordIndex]) === -1) continue;
            sticker.pos = rotateVec(sticker.pos, move.axis, move.angle);
            sticker.normal = rotateVec(sticker.normal, move.axis, move.angle);
        }
    }
}

function applyAlg(alg, facelets, n) {
    const stickers = stickersFromFacelets(facelets, n);
    for (const token of String(alg || "").trim().split(/\s+/)) {
        if (!token) continue;
        const move = parseMove(token, n);
        if (move) applyMoveToStickers(stickers, move);
    }
    return stickersToFacelets(stickers, n);
}

// 从某个 facelets 状态开始执行 alg，返回执行后的 facelets。
// 阶数由输入长度自动识别；默认 3×3。
export function applyAlgToFacelets(alg, facelets = SOLVED_FACELETS) {
    const n = orderFromFacelets(facelets) || 3;
    const fd = n === 3 ? String(facelets || SOLVED_FACELETS).padEnd(54, "o") : facelets;
    return applyAlg(alg, fd, n);
}

// 按公式库项目（2x2 … 7x7）计算 alg 执行后的 facelets。
export function applyAlgToFaceletsForPuzzle(puzzleKey, alg) {
    const n = ORDER_BY_PUZZLE[puzzleKey];
    if (!n) return "";
    return applyAlg(alg, solvedFacelets(n), n);
}

// 平面图统一按「黄顶」显示：如果公式带整体旋转导致 U 面不是黄色，
// 用整体旋转把黄色中心转回 U、绿色中心转回 F。只用于平面图，不影响 3D。
let ORIENTATION_SEQUENCES = null;
function orientationSequences() {
    if (ORIENTATION_SEQUENCES) return ORIENTATION_SEQUENCES;
    const queue = [{ seq: "", fd: SOLVED_FACELETS }];
    const seen = new Set([SOLVED_FACELETS]);
    const out = [];
    while (queue.length) {
        const item = queue.shift();
        out.push(item.seq);
        ["x", "x'", "y", "y'"].forEach((move) => {
            const seq = item.seq ? item.seq + " " + move : move;
            const fd = applyAlgToFacelets(seq);
            if (seen.has(fd)) return;
            seen.add(fd);
            queue.push({ seq, fd });
        });
    }
    ORIENTATION_SEQUENCES = out;
    return out;
}

function centerSticker(fd, faceIndex, n) {
    const base = faceIndex * n * n;
    const mid = Math.floor(n / 2);
    return fd[base + mid * n + mid];
}

export function normalizeYellowTop(facelets) {
    const fd = String(facelets || "");
    const n = orderFromFacelets(fd);
    // 2x2 没有中心块，不能用中心颜色判断朝向。
    if (!n || n < 3) return fd;
    if (centerSticker(fd, 0, n) === "u" && centerSticker(fd, 2, n) === "f") return fd;

    const sequences = orientationSequences();
    for (const seq of sequences) {
        const rotated = applyAlgToFacelets(seq, fd);
        if (centerSticker(rotated, 0, n) === "u" && centerSticker(rotated, 2, n) === "f") {
            return rotated;
        }
    }
    // 中心未完全还原（如高阶 L2C）时，至少保证黄色中心在顶面。
    for (const seq of sequences) {
        const rotated = applyAlgToFacelets(seq, fd);
        if (centerSticker(rotated, 0, n) === "u") return rotated;
    }
    return fd;
}

function lowerRowsSolved(fd, def, n) {
    const reference = fd[def.base + n];
    for (let r = 1; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (fd[def.base + r * n + c] !== reference) return false;
        }
    }
    return true;
}

// 只有顶面需要还原、下层完全没动：D 面整体同色，R/F/L/B 的下 N-1 行同色。
export function isTopLayerOnly(facelets) {
    const fd = String(facelets || "");
    const n = orderFromFacelets(fd);
    if (!n) return false;
    if (fd.indexOf("o") !== -1) return false;

    const defs = faceDefs(n);
    const d = defs[3];
    for (let i = 0; i < n * n; i++) {
        if (fd[d.base + i] !== fd[d.base]) return false;
    }
    return lowerRowsSolved(fd, defs[1], n)
        && lowerRowsSolved(fd, defs[2], n)
        && lowerRowsSolved(fd, defs[4], n)
        && lowerRowsSolved(fd, defs[5], n);
}

function colorOf(fd, index) {
    const key = fd[index];
    return COLORS[key] ? COLORS[key] : COLORS.o;
}

const SEPARATOR_COLOR = "#111111";

// ---- 2D 平面：顶面 N×N + 半格外圈；角块平行四边形，棱块梯形 ----
function flatTopSVG(fd, size, n) {
    fd = normalizeYellowTop(fd);
    const cell = 100 / (n + 1);
    const edge = cell / 2;
    const skew = cell * 0.08;
    const taper = cell * 0.06;
    const stroke = Math.max(0.35, cell * 0.04);
    const parts = [];

    const addRect = (x, y, w, h, fill) => {
        parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}"`
            + ` width="${w.toFixed(2)}" height="${h.toFixed(2)}"`
            + ` fill="${fill}" stroke="#111111" stroke-width="${stroke.toFixed(2)}"/>`);
    };
    const addPoly = (points, fill) => {
        const text = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
        parts.push(`<polygon points="${text}" fill="${fill}"`
            + ` stroke="#111111" stroke-width="${stroke.toFixed(2)}"/>`);
    };

    // 顶面本体。
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            addRect(edge + c * cell, edge + r * cell, cell, cell, colorOf(fd, r * n + c));
        }
    }

    const addHorizontal = (side, indexOf) => {
        const innerY = side === "top" ? edge : 100 - edge;
        const outerY = side === "top" ? 0 : 100;
        for (let c = 0; c < n; c++) {
            const x0 = edge + c * cell;
            const x1 = x0 + cell;
            const isCorner = n <= 2 || c === 0 || c === n - 1;
            const dx0 = isCorner ? (c === 0 ? skew : -skew) : taper;
            const dx1 = isCorner ? (c === n - 1 ? -skew : skew) : -taper;
            addPoly([
                [x0, innerY], [x1, innerY], [x1 + dx1, outerY], [x0 + dx0, outerY],
            ], colorOf(fd, indexOf(c)));
        }
    };
    const addVertical = (side, indexOf) => {
        const innerX = side === "left" ? edge : 100 - edge;
        const outerX = side === "left" ? 0 : 100;
        for (let r = 0; r < n; r++) {
            const y0 = edge + r * cell;
            const y1 = y0 + cell;
            const isCorner = n <= 2 || r === 0 || r === n - 1;
            const dy0 = isCorner ? (r === 0 ? skew : -skew) : taper;
            const dy1 = isCorner ? (r === n - 1 ? -skew : skew) : -taper;
            addPoly([
                [innerX, y0], [innerX, y1], [outerX, y1 + dy1], [outerX, y0 + dy0],
            ], colorOf(fd, indexOf(r)));
        }
    };

    addHorizontal("top", (c) => 5 * n * n + (n - 1 - c));
    addHorizontal("bottom", (c) => 2 * n * n + c);
    addVertical("left", (r) => 4 * n * n + r);
    addVertical("right", (r) => n * n + (n - 1 - r));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible" role="img" aria-label="LSLL 顶面状态">`
        + parts.join("")
        + `</svg>`;
}

// ---- 3D 折叠：把 U/F/R 三个面按等距投影折起来 ----
const SCALE = 50;
const COS30 = Math.sqrt(3) / 2;
const SIN30 = 0.5;
const CX = 50;
const CY = 50;
const TOP = [CX, CY - SCALE];
const RIGHT = [CX + COS30 * SCALE, CY - SIN30 * SCALE];
const FRONT = [CX, CY];
const LEFT = [CX - COS30 * SCALE, CY - SIN30 * SCALE];
const LEFT_BOTTOM = [CX - COS30 * SCALE, CY + SIN30 * SCALE];
const FRONT_BOTTOM = [CX, CY + SCALE];
const RIGHT_BOTTOM = [CX + COS30 * SCALE, CY + SIN30 * SCALE];

function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bilinear(a, b, c, d, u, v) {
    return mix(mix(a, b, u), mix(d, c, u), v);
}

const FACES = {
    // U：行 0 是后边，列 0 是左边。
    U: (u, v) => bilinear(TOP, RIGHT, FRONT, LEFT, u, v),
    // F：行 0 是上边，列 0 是左边。
    F: (u, v) => bilinear(LEFT, FRONT, FRONT_BOTTOM, LEFT_BOTTOM, u, v),
    // R：行 0 是上边，列 0 是左边（与 F 共用的前棱）。
    R: (u, v) => bilinear(FRONT, RIGHT, RIGHT_BOTTOM, FRONT_BOTTOM, u, v),
};

function stickerPolygon(face, row, col, fill, n) {
    const u0 = col / n;
    const u1 = (col + 1) / n;
    const v0 = row / n;
    const v1 = (row + 1) / n;
    const points = [face(u0, v0), face(u1, v0), face(u1, v1), face(u0, v1)]
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");
    return `<polygon points="${points}" fill="${fill}"/>`;
}

// 3D 折叠图可只保留棱块：edgesOnly 去掉四个角；orientationOnly 把黄/非黄压成
// 黄色与灰色，专门看棱块色相；unsolved 可以让指定区域只显示黄色/深灰。
function stickerFill(fd, index, options, faceKey, row, col, n) {
    if (options.unsolved && options.unsolved(faceKey, row, col, n)) {
        return fd[index] === "u" ? COLORS.u : (options.muted || "#4d4d4d");
    }
    if (options.orientationOnly) {
        return fd[index] === "u" ? COLORS.u : (options.muted || "#e7edf5");
    }
    return colorOf(fd, index);
}

function foldedCubeSVG(fd, size, n, options = {}) {
    const cells = [];
    const addFace = (face, base, faceKey) => {
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                if (options.edgesOnly && n === 3
                    && (row === 0 || row === n - 1)
                    && (col === 0 || col === n - 1)) {
                    continue;
                }
                const index = base + row * n + col;
                cells.push(stickerPolygon(face, row, col,
                    stickerFill(fd, index, options, faceKey, row, col, n), n));
            }
        }
    };
    addFace(FACES.U, 0, "U");
    addFace(FACES.F, 2 * n * n, "F");
    addFace(FACES.R, n * n, "R");

    // 面内格子分隔线、面与面折线，以及最外层轮廓。
    const lines = [];
    const stroke = 0.55 * (3 / n);
    const separator = `stroke="${SEPARATOR_COLOR}" stroke-width="${stroke.toFixed(2)}" stroke-linecap="round"`;
    const addLine = (a, b) => {
        lines.push(`<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}"`
            + ` x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" ${separator}/>`);
    };
    for (const face of [FACES.U, FACES.F, FACES.R]) {
        for (let i = 1; i < n; i++) {
            addLine(face(i / n, 0), face(i / n, 1));
            addLine(face(0, i / n), face(1, i / n));
        }
    }
    addLine(LEFT, FRONT);
    addLine(FRONT, RIGHT);
    addLine(FRONT, FRONT_BOTTOM);

    const outline = [TOP, RIGHT, RIGHT_BOTTOM, FRONT_BOTTOM, LEFT_BOTTOM, LEFT]
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible" role="img" aria-label="LSLL 立体状态">`
        + cells.join("")
        + lines.join("")
        + `<polygon points="${outline}" fill="none" stroke="${SEPARATOR_COLOR}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round"/>`
        + `</svg>`;
}

// OLL 状态图：顶面 N×N 用黄色/深灰画出朝上的贴纸，四周只把朝向侧面的黄色贴纸
// 画成与顶面同样大小的黄色块。这样能同时看清顶面形状和侧面黄色贴纸的位置。
// options.label 可覆盖无障碍标签（二阶 CLL / EG 用「顶面状态」）。
export function topFacePatternSVG(facelets, size = 96, options = {}) {
    let fd = String(facelets || "");
    let n = orderFromFacelets(fd);
    if (!n) {
        n = 3;
        fd = fd.padEnd(54, "o");
    }
    fd = normalizeYellowTop(fd);
    // 中间 n×n 是顶面，外圈只留半格厚度：侧面黄色块沿顶面边的宽度与中心格相同，
    // 向外只伸出半格，正好贴在对应中心格的外侧。
    const cell = 100 / (n + 1);
    const edge = cell / 2;
    // 幅度要小：只让角块/棱块有一点点斜度，远看仍像贴合的方块。
    const skew = cell * 0.08;
    const taper = cell * 0.06;
    const stroke = Math.max(0.35, cell * 0.04);
    const yellow = COLORS.u;
    const muted = options.muted || "#4d4d4d";
    const cells = [];

    const addRect = (x, y, w, h, fill) => {
        cells.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}"`
            + ` width="${w.toFixed(2)}" height="${h.toFixed(2)}"`
            + ` fill="${fill}" stroke="#111111" stroke-width="${stroke.toFixed(2)}"/>`);
    };
    const addPoly = (points) => {
        const text = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
        cells.push(`<polygon points="${text}" fill="${yellow}"`
            + ` stroke="#111111" stroke-width="${stroke.toFixed(2)}"/>`);
    };

    // 顶面本体：黄色表示已朝上，深灰表示黄色贴纸在侧面。
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            addRect(edge + c * cell, edge + r * cell, cell, cell,
                fd[r * n + c] === "u" ? yellow : muted);
        }
    }

    // 侧面顶行里朝向侧面的黄色贴纸：只画黄色，不画其他颜色。
    // 沿顶面边的宽度与中心格一致，向外只伸出半格；角块做成轻微平行四边形，
    // 棱块做成轻微梯形，模拟外侧翻折的透视感。
    const isCorner = (index) => n <= 2 || index === 0 || index === n - 1;

    for (let c = 0; c < n; c++) {
        if (fd[5 * n * n + (n - 1 - c)] !== "u") continue;
        const x0 = edge + c * cell;
        const x1 = x0 + cell;
        const dx0 = isCorner(c) ? (c === 0 ? skew : -skew) : taper;
        const dx1 = isCorner(c) ? (c === n - 1 ? -skew : skew) : -taper;
        addPoly([[x0, edge], [x1, edge], [x1 + dx1, 0], [x0 + dx0, 0]]);
    }
    for (let c = 0; c < n; c++) {
        if (fd[2 * n * n + c] !== "u") continue;
        const x0 = edge + c * cell;
        const x1 = x0 + cell;
        const dx0 = isCorner(c) ? (c === 0 ? skew : -skew) : taper;
        const dx1 = isCorner(c) ? (c === n - 1 ? -skew : skew) : -taper;
        addPoly([[x0, 100 - edge], [x1, 100 - edge], [x1 + dx1, 100], [x0 + dx0, 100]]);
    }
    for (let r = 0; r < n; r++) {
        if (fd[4 * n * n + r] !== "u") continue;
        const y0 = edge + r * cell;
        const y1 = y0 + cell;
        const dy0 = isCorner(r) ? (r === 0 ? skew : -skew) : taper;
        const dy1 = isCorner(r) ? (r === n - 1 ? -skew : skew) : -taper;
        addPoly([[edge, y0], [edge, y1], [0, y1 + dy1], [0, y0 + dy0]]);
    }
    for (let r = 0; r < n; r++) {
        if (fd[n * n + (n - 1 - r)] !== "u") continue;
        const y0 = edge + r * cell;
        const y1 = y0 + cell;
        const dy0 = isCorner(r) ? (r === 0 ? skew : -skew) : taper;
        const dy1 = isCorner(r) ? (r === n - 1 ? -skew : skew) : -taper;
        addPoly([[100 - edge, y0], [100 - edge, y1], [100, y1 + dy1], [100, y0 + dy0]]);
    }

    const label = options.label || "OLL 状态";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible" role="img" aria-label="${label}">`
        + cells.join("")
        + `</svg>`;
}

// 传入 facelets，按状态自动选择平面或 3D；阶数由长度自动识别。
// options.forceFlat / options.force3D 用于分类固定视角（如 CMLL 只看顶层、LSE 必须看立体）。
export function cubeThumbSVG(facelets, size = 96, options = {}) {
    let fd = String(facelets || "");
    let n = orderFromFacelets(fd);
    if (!n) {
        n = 3;
        fd = fd.padEnd(54, "o");
    }
    if (options.forceFlat) return flatTopSVG(fd, size, n);
    if (options.force3D) return foldedCubeSVG(fd, size, n, options);
    if (isTopLayerOnly(fd)) return flatTopSVG(fd, size, n);
    return foldedCubeSVG(fd, size, n, options);
}

export function cubeNetFaces(facelets) {
    let fd = String(facelets || "");
    let n = orderFromFacelets(fd);
    if (!n) {
        n = 3;
        fd = fd.padEnd(54, "o");
    }
    return Array.from({ length: 6 }, (_, index) => fd.slice(index * n * n, (index + 1) * n * n));
}

// 六面平面展开图。U 在上，L/F/R/B 横向展开，D 在下；
// 六个面的全部贴纸都参与绘制，用于计时打乱和公式状态的完整平面展示。
export function cubeNetSVG(facelets, size = 240, options = {}) {
    const faces = cubeNetFaces(facelets);
    const n = Math.round(Math.sqrt(faces[0].length));
    const positions = {
        u: [1, 0],
        l: [0, 1],
        f: [1, 1],
        r: [2, 1],
        b: [3, 1],
        d: [1, 2],
    };
    const labels = { u: "U", l: "L", f: "F", r: "R", b: "B", d: "D" };
    const width = 4 * n;
    const height = 3 * n;
    const cells = [];

    FACE_KEYS.forEach((faceKey, faceIndex) => {
        const [faceX, faceY] = positions[faceKey];
        const stickers = [];
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                const value = faces[faceIndex][row * n + col] || "o";
                stickers.push(`<rect x="${faceX * n + col}" y="${faceY * n + row}" width="1" height="1" `
                    + `fill="${COLORS[value] || COLORS.o}" stroke="#111111" stroke-width="0.035"/>`);
            }
        }
        cells.push(`<g data-face="${faceKey}" aria-label="${labels[faceKey]} 面">${stickers.join("")}</g>`);
    });

    const label = options.label || "魔方六面平面展开图";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" `
        + `width="${size}" height="${Math.round(size * height / width)}" `
        + `data-layout="cube-net" role="img" aria-label="${label}">${cells.join("")}</svg>`;
}
