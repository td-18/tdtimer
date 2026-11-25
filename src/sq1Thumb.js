// Square-1 状态缩略图：自绘 3D 渲染。
//
// 公式库原先用 cubing.js 的 twisty-player 画 SQ1，但它的 SQ1 模型只暴露
// WEDGES / EQUATOR，没法单独把「顶面」改成黑色（只能整张图灰度）。
//
// 这里仍然用 cubing.js 的 square1 KPuzzle 计算状态（保证和 3D 演示完全一致），
// 但把 WEDGES 的 24 个 30° wedge 自己投影成 SVG 棱柱：
//   - 位置 0..11 是顶层，12..23 是底层；
//   - 角块由两个相邻 wedge 组成，棱块是一个 wedge；
//   - 顶/底面按 wedge 原来的层涂黄/白，外缘按固定侧面颜色涂红/绿/蓝/橙。
// 这样外层套上 .sq1BlackTop 时只覆盖顶面，侧面颜色仍然保留。

const DEG = Math.PI / 180;
const SLOT_DEG = 30;
// 解好的 Square-1 正方形，中心到边的距离是 1，角块顶点到中心是 √2。
const APOTHEM = 1;
const EDGE_R = APOTHEM / Math.cos(15 * DEG);
const TIP_R = Math.SQRT2;
// 方形面边长仍是 2（x/z ∈ [-1,1]），上下层厚度比原来薄 20%（0.8 → 0.64），
// 中层保持 0.4 不变；整体高度再 +10%、宽度 −5%，由下面的宽高比系数统一处理。
const Y_TOP = 0.84;
const Y_LAYER_INNER = 0.20;
const Y_BOTTOM = -0.84;
const Y_MID = 0.20;
// 贴纸之间留很细的黑缝（参考图的线宽），配合下面更细的描边。
const STICKER_SCALE = 0.93;
// 图形在 100×100 viewBox 里按最长边缩放到 FIT_TARGET，四周留白；
// 比例固定，所有状态（含形状模式）都用同一套缩放，缩略图之间大小一致。
const FIT_TARGET = 47;
const EDGE_STROKE = 0.5;
// 整体宽高比微调：在上一版基础上高度 +10%、宽度 −5%。
const WIDTH_RATIO = 0.95;
const HEIGHT_RATIO = 1.1;

// 侧面四色取自参考图：红 #E2231A / 绿 #00A651 / 橙 #F58220 / 蓝 #1E3F94。
const SIDE_COLORS = {
    red: "#E2231A",
    green: "#00A651",
    orange: "#F58220",
    blue: "#1E3F94",
};
const TOP_COLOR = "#FFD500";
const BOTTOM_COLOR = "#F4F4F4";
const INNER_COLOR = "#1B1B1B";
const SHAPE_TOP = "#B9B9B9";
const SHAPE_SIDE = "#8A8A8A";
const SHAPE_INNER = "#5A5A5A";
// 朝向模式（CO / EO / OBL）只展示顶面朝向，侧面和底层不承载信息，
// 用比参考图再浅一档的灰色代替黑色，和其他状态卡片的留白风格一致。
const UNSHOWN_SIDE = "#9A9A9A";
const UNSHOWN_INNER = "#7A7A7A";
const OUTLINE = "#101010";

// 方向光：从左前上方打过来，让正对光源的面最亮，背面最暗，
// 这样侧面和顶面都有明暗变化，体积感更接近真实魔方。
const LIGHT = (() => {
    const v = [-0.55, 0.72, 0.42];
    const len = Math.hypot(...v);
    return v.map((c) => c / len);
})();

// 本文件所有多边形的绕向约定一致：由前三个顶点算出的几何法线指向块的内侧，
// 所以朝外的法线是它的反向。棱柱的上下盖、外缘侧面和中层方带都遵循这个约定。
function outwardNormal(points) {
    const a = points[0];
    const b = points[1];
    const c = points[2];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = -(uy * vz - uz * vy);
    const ny = -(uz * vx - ux * vz);
    const nz = -(ux * vy - uy * vx);
    const len = Math.hypot(nx, ny, nz);
    if (!len) return null;
    return [nx / len, ny / len, nz / len];
}

function shade(hex, normal) {
    const lambert = normal
        ? Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2])
        : 0.5;
    const factor = 0.66 + 0.46 * lambert;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const bl = parseInt(hex.slice(5, 7), 16);
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${clamp(r * factor).toString(16).padStart(2, "0")}`
        + `${clamp(g * factor).toString(16).padStart(2, "0")}`
        + `${clamp(bl * factor).toString(16).padStart(2, "0")}`;
}

const EDGE_IDS = new Set([2, 5, 8, 11, 12, 15, 18, 21]);
const CORNER_PAIRS = [
    [0, 1], [3, 4], [6, 7], [9, 10],
    [13, 14], [16, 17], [19, 20], [22, 23],
];
const CORNER_OF = new Map();
CORNER_PAIRS.forEach(([lower, upper], index) => {
    CORNER_OF.set(lower, index);
    CORNER_OF.set(upper, index);
});

// cubing.js square1 贴纸的固定侧面颜色（按 WEDGES-0 … WEDGES-23 的顺序）。
// 顶层黄、底层白；每三个连续 wedge 是同一条侧面颜色带。
// 为了让默认视角和模板一致（左红、右绿），这里把四条色带重新映射：
// 60° 绿、150° 红、240° 橙、330° 蓝。
const WEDGE_SIDE = [
    "blue", "green", "green", "green", "red", "red", "red", "orange", "orange", "orange", "blue", "blue",
    "blue", "blue", "orange", "orange", "orange", "red", "red", "red", "green", "green", "green", "blue",
];

// 每个 wedge 的固定信息。棱块/角块分组见 EDGE_IDS 与 CORNER_PAIRS。
const WEDGE_META = Array.from({ length: 24 }, (_, id) => {
    const layer = id < 12 ? 0 : 1;
    const isEdge = EDGE_IDS.has(id);
    return {
        id,
        layer,
        isEdge,
        cornerKey: isEdge ? null : CORNER_OF.get(id),
        sideColor: WEDGE_SIDE[id] || "blue",
        axial: layer === 0 ? "u" : "d",
    };
});

function radial(angleDeg, radius) {
    const a = angleDeg * DEG;
    return [radius * Math.cos(a), radius * Math.sin(a)];
}

// 一个 wedge 的平面轮廓（返回 [x, z] 点列），从内角开始。
// start 是 30° 槽位编号，span 是 1（棱块）或 2（角块）。
// cubing.js 的底层位置顺序是从上往下看反向的，而且整体错开 30°：
//   top:    a = start*30 - 15
//   bottom: a = -(start + span - 1)*30 - 45
function wedgeShape(start, span, layer = 0) {
    const a0 = layer === 0
        ? start * SLOT_DEG - SLOT_DEG / 2
        : -(start + span - 1) * SLOT_DEG - SLOT_DEG * 1.5;
    const a1 = a0 + span * SLOT_DEG;
    const p0 = radial(a0, EDGE_R);
    const p1 = radial(a1, EDGE_R);
    if (span <= 1) {
        return { poly: [[0, 0], p0, p1] };
    }
    const tip = radial((a0 + a1) / 2, TIP_R);
    return { poly: [[0, 0], p0, tip, p1] };
}

// 按物理块把一层 12 个槽位分组：一个 wedge = 棱块，两个相邻 wedge = 角块。
function layerGroups(pieces, layer) {
    const base = layer === 0 ? 0 : 12;
    const groups = new Map();
    for (let pos = 0; pos < 12; pos++) {
        const id = pieces[base + pos];
        const meta = WEDGE_META[id];
        if (!meta) continue;
        const key = meta.isEdge ? `e${id}` : `c${meta.cornerKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ pos, id });
    }
    const out = [];
    groups.forEach((items) => {
        if (items.length < 2) {
            out.push({ start: items[0].pos, span: 1, ids: [items[0].id] });
            return;
        }
        const positions = items.map((item) => item.pos).sort((a, b) => a - b);
        const a = positions[0];
        const b = positions[1];
        const diff = (b - a + 12) % 12;
        if (diff !== 1 && diff !== 11) {
            // 非标准/非法状态：两个 wedge 不相邻时拆成两块画，避免越界。
            items.forEach((item) => out.push({ start: item.pos, span: 1, ids: [item.id] }));
            return;
        }
        // 两个槽位在角度上相邻；如果差值（模 12）为 1，a 在前，
        // 否则是 0/11 回绕，b 在前（11 → 0）。
        const start = diff === 1 ? a : b;
        const idAt = (pos) => (items.find((item) => item.pos === pos) || {}).id;
        const pair = [idAt(start), idAt((start + 1) % 12)];
        // 底层的角度方向相反，外缘两个侧面在物理角度上的顺序也要反过来。
        out.push({ start, span: 2, ids: layer === 0 ? pair : pair.slice().reverse() });
    });
    return out;
}

function projectPoint([x, y, z]) {
    // 先绕 Y 轴转（看到左前两个侧面），再绕 X 轴俯视。
    const yawCos = Math.cos(ACTIVE.yaw);
    const yawSin = Math.sin(ACTIVE.yaw);
    const x1 = x * yawCos + z * yawSin;
    const z1 = -x * yawSin + z * yawCos;
    const pitchCos = Math.cos(ACTIVE.pitch);
    const pitchSin = Math.sin(ACTIVE.pitch);
    const y1 = y * pitchCos - z1 * pitchSin;
    const z2 = y * pitchSin + z1 * pitchCos;
    return [x1, -y1, z2];
}

const DEFAULT_YAW = 34 * DEG;
const DEFAULT_PITCH = 30 * DEG;
let ACTIVE = null;

// 用一个参考轮廓确定固定缩放，保证所有状态的缩略图大小一致。
// 参考轮廓取每一层的最大半径（角块尖端 TIP_R / 棱块外缘 EDGE_R）绕一圈，
// 再按投影后的包围盒缩放，让图形正好填满 viewBox。
function buildActiveView(yaw, pitch) {
    ACTIVE = { yaw, pitch };
    const probes = [];
    for (let angle = 0; angle < 360; angle += 10) {
        for (const [y, radius] of [[Y_TOP, TIP_R], [-Y_LAYER_INNER, TIP_R],
            [Y_MID, EDGE_R], [-Y_MID, EDGE_R], [Y_BOTTOM, TIP_R]]) {
            const [x, z] = radial(angle, radius);
            probes.push(projectPoint([x, y, z]));
        }
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    probes.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });
    const span = Math.max(maxX - minX, maxY - minY, 0.0001);
    ACTIVE.view = {
        scale: FIT_TARGET / span,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
    };
}

function toScreen(point) {
    const [x, y] = projectPoint(point);
    const view = ACTIVE.view;
    return [50 + (x - view.cx) * view.scale * WIDTH_RATIO,
        50 + (y - view.cy) * view.scale * HEIGHT_RATIO];
}

function pointsToPolygon(points, fill, cls = "", outline = true) {
    const text = points.map((p) => {
        const [x, y] = toScreen(p);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
    const classAttr = cls ? ` class="${cls}"` : "";
    const stroke = outline ? ` stroke="${OUTLINE}" stroke-width="${EDGE_STROKE}" stroke-linejoin="round"` : "";
    return `<polygon points="${text}" fill="${fill}"${stroke}${classAttr}/>`;
}

function averageDepth(points) {
    let sum = 0;
    points.forEach((p) => { sum += projectPoint(p)[2]; });
    return sum / points.length;
}

// 背面剔除：朝外法线背对相机的面一定看不见（例如上层的黑色底面），
// 画出来只会盖住中层的侧面贴纸，所以直接丢掉。
function face(points, fill, cls = "") {
    const normal = outwardNormal(points);
    if (normal && projectPoint(normal)[2] <= 0) return null;
    return { points, fill: shade(fill, normal), cls, depth: averageDepth(points) };
}

// 保留深色块体，只缩小贴纸；同一面的贴纸紧跟块体绘制，共用深度排序。
function stickerFace(points, fill, cls, bodyFill) {
    const body = face(points, bodyFill);
    if (!body) return null;
    const center = [0, 1, 2].map((axis) =>
        points.reduce((sum, point) => sum + point[axis], 0) / points.length);
    const inset = points.map((point) => point.map((value, axis) =>
        center[axis] + (value - center[axis]) * STICKER_SCALE));
    body.sticker = face(inset, fill, cls);
    return body;
}

function prismFaces(shape, yLow, yHigh, topFill, bottomFill, sideFills, innerFill) {
    const faces = [];
    const ringLow = shape.poly.map(([x, z]) => [x, yLow, z]);
    const ringHigh = shape.poly.map(([x, z]) => [x, yHigh, z]);
    const cap = (points, { fill, cls }) => fill === innerFill
        ? face(points, fill) : stickerFace(points, fill, cls, innerFill);
    faces.push(cap(ringHigh, topFill));
    faces.push(cap(ringLow.slice().reverse(), bottomFill));
    shape.poly.forEach((a, i) => {
        const b = shape.poly[(i + 1) % shape.poly.length];
        const fill = sideFills[i - 1];
        const points = [
            [a[0], yLow, a[1]],
            [b[0], yLow, b[1]],
            [b[0], yHigh, b[1]],
            [a[0], yHigh, a[1]],
        ];
        faces.push(fill ? stickerFace(points, fill, "", innerFill) : face(points, innerFill));
    });
    return faces.filter(Boolean);
}

function middleFaces(equatorOrientation, mode) {
    // 切口穿过 -15° / 165° 的槽位边界，将赤道分为两个独立块体。
    const seam = radial(-15, 1);
    const corners = [15, 105, 195, 285].map((angle) => radial(angle, TIP_R));
    const cut = radial(-15, EDGE_R);
    const opposite = cut.map((value) => -value);
    const halves = [
        { ring: [cut, corners[0], corners[1], opposite], colors: ["blue", "green", "red"] },
        { ring: [opposite, corners[2], corners[3], cut], colors: ["red", "orange", "blue"] },
    ];
    return halves.flatMap(({ ring, colors }, half) => {
        const flip = half === 1 && equatorOrientation === 3;
        const offset = half === 0 ? 0.016 : -0.016;
        const placed = ring.map(([x, z], index) => {
            if (flip) {
                // 绕切口的垂线翻转半块；切口仍在原位，但外缘和颜色对调。
                const along = x * seam[0] + z * seam[1];
                x -= 2 * along * seam[0];
                z -= 2 * along * seam[1];
            }
            // 外角与上下层共用轮廓，只内移切口上的点以保留接缝。
            return index === 0 || index === ring.length - 1
                ? [x - seam[1] * offset, z + seam[0] * offset]
                : [x, z];
        });
        const sideFills = mode === "full" ? colors.map((name) => SIDE_COLORS[name]) : [];
        if (flip) {
            placed.reverse();
            sideFills.reverse();
        }
        // 中层的块体颜色跟上下层保持一致：完整配色用黑色塑料，形状模式用
        // 侧面色，只显示朝向时用灰。这样中层不会单独出现一条深色带。
        const bodyFill = mode === "full"
            ? INNER_COLOR
            : mode === "shape" ? SHAPE_SIDE : UNSHOWN_SIDE;
        const poly = [placed.pop(), ...placed];
        return prismFaces({ poly }, -Y_MID, Y_MID,
            { fill: bodyFill }, { fill: bodyFill }, sideFills, bodyFill);
    });
}

function axialFill(axial, mode) {
    if (mode === "orientation") {
        return axial === "u"
            ? { fill: TOP_COLOR, cls: "sq1TopU" }
            : { fill: "#E2E2E2", cls: "sq1TopD" };
    }
    return axial === "u"
        ? { fill: TOP_COLOR, cls: "sq1TopU" }
        : { fill: BOTTOM_COLOR, cls: "sq1TopD" };
}

// 把 cubing.js square1 KPattern 的 24 个 wedge 画成 SVG。
// 赤道（中层）朝向从 options.equator 或 pieces.equator 读取，缺省按还原状态。
export function sq1ThumbSVG(pieces, size = 64, options = {}) {
    const mode = options.mode || "full";
    const equator = options.equator === undefined
        ? (pieces && pieces.equator) || 0
        : options.equator;
    const yaw = options.yaw === undefined ? DEFAULT_YAW : Number(options.yaw) * DEG;
    const pitch = options.pitch === undefined ? DEFAULT_PITCH : Number(options.pitch) * DEG;
    buildActiveView(yaw, pitch);

    const wedges = Array.isArray(pieces) ? pieces : (pieces && pieces.wedges);
    const data = Array.isArray(wedges) && wedges.length === 24
        ? wedges
        : Array.from({ length: 24 }, (_, i) => i);

    const layerFaces = (layer) => {
        const faces = [];
        const yLow = layer === 0 ? Y_LAYER_INNER : Y_BOTTOM;
        const yHigh = layer === 0 ? Y_TOP : -Y_LAYER_INNER;
        layerGroups(data, layer).forEach(({ start, span, ids }) => {
            const shape = wedgeShape(start, span, layer);
            if (mode === "shape") {
                faces.push(...prismFaces(shape, yLow, yHigh,
                    { fill: SHAPE_TOP }, { fill: SHAPE_INNER },
                    [SHAPE_SIDE, SHAPE_SIDE], SHAPE_INNER));
                return;
            }
            const metas = ids.map((id) => WEDGE_META[id]);
            const axial = axialFill(metas[0].axial, mode);
            if (mode === "orientation") {
                faces.push(...prismFaces(shape, yLow, yHigh,
                    axial, { fill: UNSHOWN_SIDE },
                    [UNSHOWN_SIDE, UNSHOWN_SIDE], UNSHOWN_INNER));
                return;
            }
            const sideFills = metas.map((meta) => SIDE_COLORS[meta.sideColor] || SIDE_COLORS.blue);
            faces.push(...prismFaces(shape, yLow, yHigh,
                layer === 0 ? axial : { fill: INNER_COLOR },
                layer === 0 ? { fill: INNER_COLOR } : axial,
                sideFills, INNER_COLOR));
        });
        return faces;
    };

    const sortFaces = (faces) => faces.sort((a, b) => a.depth - b.depth);
    const renderFace = (f) => pointsToPolygon(f.points, f.fill, f.cls)
        + (f.sticker ? pointsToPolygon(f.sticker.points, f.sticker.fill, f.sticker.cls, false) : "");
    // 按层从下往上画，避免大面片质心排序把中层/底层压到顶层上。
    const groups = [layerFaces(1), middleFaces(equator, mode), layerFaces(0)];
    const body = groups
        .map((faces) => sortFaces(faces).map(renderFace).join(""))
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"`
        + ` class="sq1Thumb" style="overflow:visible" aria-hidden="true">`
        + body
        + `</svg>`;
}

// CO / EO / OBL：上下层分开的平面黑白图（左顶层、右底层）。
// 每块按「朝外的颜色」上色：黑 = 黄色面朝外（axial u），白 = 白色面朝外（d）。
// 这样顶层显示顶面配色、底层显示底面配色，能直接看出哪一块需要调整。
const FLAT_VIEW_W = 100;
const FLAT_VIEW_H = 50;
const FLAT_PANEL = 42;
const FLAT_SCALE = FLAT_PANEL / (2 * TIP_R);
const FLAT_CENTERS = [24, 76];

export function sq1OrientationSVG(pieces, size = 150, options = {}) {
    // CO 只看角块朝向，棱块不画，避免干扰。
    const showEdges = options.showEdges !== false;
    const list = Array.isArray(pieces) ? pieces : (pieces && pieces.wedges);
    const data = Array.isArray(list) && list.length === 24
        ? list
        : Array.from({ length: 24 }, (_, i) => i);
    // 按顶层的角块把整个平面图转正：让方块的四角落在 45° 方向，
    // 两层共用同一个转角，保留上下层之间的相对朝向。
    const corner = layerGroups(data, 0).find((group) => group.span > 1);
    let rotate = 0;
    if (corner) {
        const tipDeg = corner.start * SLOT_DEG + SLOT_DEG / 2;
        rotate = (45 - tipDeg) * DEG;
        rotate = ((rotate / DEG) % 90 + 90) % 90;
        if (rotate > 45) rotate -= 90;
        rotate *= DEG;
    }
    const rotCos = Math.cos(rotate);
    const rotSin = Math.sin(rotate);
    const upright = ([x, z]) => [x * rotCos - z * rotSin, x * rotSin + z * rotCos];
    const cy = FLAT_VIEW_H / 2;
    let body = "";
    [0, 1].forEach((layer) => {
        const cx = FLAT_CENTERS[layer];
        layerGroups(data, layer).forEach(({ start, span, ids }) => {
            if (!showEdges && span <= 1) return;
            const { poly } = wedgeShape(start, span, layer);
            const axial = WEDGE_META[ids[0]].axial;
            const points = poly.map(([rawX, rawZ]) => {
                const [x, z] = upright([rawX, rawZ]);
                return `${(cx + x * FLAT_SCALE).toFixed(2)},${(cy + z * FLAT_SCALE).toFixed(2)}`;
            }).join(" ");
            body += `<polygon points="${points}" fill="${axial === "u" ? "#111111" : "#FFFFFF"}"`
                + ` stroke="#111111" stroke-width="1" stroke-linejoin="round"/>`;
        });
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FLAT_VIEW_W} ${FLAT_VIEW_H}"`
        + ` width="${size}" height="${Math.round(size * FLAT_VIEW_H / FLAT_VIEW_W)}"`
        + ` class="sq1FlatThumb" aria-hidden="true">${body}</svg>`;
}

let square1KPuzzlePromise = null;
function square1KPuzzle() {
    if (!square1KPuzzlePromise) {
        square1KPuzzlePromise = import("https://cdn.cubing.net/v0/js/cubing/puzzles")
            .then((mod) => mod.puzzles.square1.kpuzzle())
            .catch((err) => {
                square1KPuzzlePromise = null;
                throw err;
            });
    }
    return square1KPuzzlePromise;
}

// 用 cubing.js 的 square1 KPuzzle 执行公式，返回 24 个 wedge 的位置数组。
// 和 twisty-player 的状态完全一致，避免自己实现 SQ1 记法时出现方向/相位偏差。
export async function sq1PiecesFromAlg(alg) {
    const kpuzzle = await square1KPuzzle();
    const pattern = kpuzzle.algToTransformation(String(alg || "").trim()).toKPattern();
    const wedges = pattern.patternData.WEDGES.pieces;
    // 仍然返回 24 个 wedge 的数组（保持调用方不变），
    // 中层朝向作为附加属性带出来，供 sq1ThumbSVG 画方带。
    const out = Array.from(wedges);
    const equator = pattern.patternData.EQUATOR;
    out.equator = equator && equator.orientation ? equator.orientation[1] : 0;
    return out;
}
