// Square-1 状态模型 + 随机状态求解器（M2）
//
// 三阶段结构：
//   1. 形状表：把 Square-1 的形状压缩成 7,536 个索引，BFS 求形状距离；
//   2. 排列表：8 角 + 8 棱的排列距离；
//   3. 两阶段搜索：先回到可做 / 的形状，再复原角/棱排列与中层。
//
// 算法参考公开的 Square-1 两阶段求解思路（csTimer/TNoodle 系列），
// 代码为本地重写；表在 worker 内懒加载并缓存。

import { rankPerm, unrankPerm } from "../lib/perm.js";

const SHAPE_COUNT = 3678;
const SHAPE_STATE_COUNT = 7536;
const SQUARE_PERM_COUNT = 40320;
const SQUARE_STATE_COUNT = 80640;

const SHAPE_HALFLAYER = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];

export function newCube() {
    return {
        ul: 0x011233,
        ur: 0x455677,
        dl: 0x998bba,
        dr: 0xddcffe,
        ml: 0,
    };
}

export function copyCube(cube) {
    return { ul: cube.ul, ur: cube.ur, dl: cube.dl, dr: cube.dr, ml: cube.ml };
}

export function cubeToString(cube) {
    return (
        cube.ul.toString(16).padStart(6, "0") +
        cube.ur.toString(16).padStart(6, "0") +
        "|/".charAt(cube.ml) +
        cube.dl.toString(16).padStart(6, "0") +
        cube.dr.toString(16).padStart(6, "0")
    );
}

export function pieceAt(cube, index) {
    let value;
    if (index < 6) value = cube.ul >> ((5 - index) << 2);
    else if (index < 12) value = cube.ur >> ((11 - index) << 2);
    else if (index < 18) value = cube.dl >> ((17 - index) << 2);
    else value = cube.dr >> ((23 - index) << 2);
    return value & 0xf;
}

export function setPiece(cube, index, value) {
    if (index < 6) {
        cube.ul &= ~(0xf << ((5 - index) << 2));
        cube.ul |= value << ((5 - index) << 2);
    } else if (index < 12) {
        cube.ur &= ~(0xf << ((11 - index) << 2));
        cube.ur |= value << ((11 - index) << 2);
    } else if (index < 18) {
        cube.dl &= ~(0xf << ((17 - index) << 2));
        cube.dl |= value << ((17 - index) << 2);
    } else {
        cube.dr &= ~(0xf << ((23 - index) << 2));
        cube.dr |= value << ((23 - index) << 2);
    }
}

// move > 0: 顶层顺时针；move < 0: 底层顺时针；move = 0: /
export function doMove(cube, move) {
    const bits = move * 4;
    let temp;

    if (bits > 24) {
        const shift = 48 - bits;
        temp = cube.ul;
        cube.ul = ((cube.ul >> shift) | (cube.ur << (24 - shift))) & 0xffffff;
        cube.ur = ((cube.ur >> shift) | (temp << (24 - shift))) & 0xffffff;
    } else if (bits > 0) {
        const shift = bits;
        temp = cube.ul;
        cube.ul = ((cube.ul << shift) | (cube.ur >> (24 - shift))) & 0xffffff;
        cube.ur = ((cube.ur << shift) | (temp >> (24 - shift))) & 0xffffff;
    } else if (bits === 0) {
        temp = cube.ur;
        cube.ur = cube.dl;
        cube.dl = temp;
        cube.ml = 1 - cube.ml;
    } else if (bits >= -24) {
        const shift = -bits;
        temp = cube.dl;
        cube.dl = ((cube.dl << shift) | (cube.dr >> (24 - shift))) & 0xffffff;
        cube.dr = ((cube.dr << shift) | (temp >> (24 - shift))) & 0xffffff;
    } else {
        const shift = 48 + bits;
        temp = cube.dl;
        cube.dl = ((cube.dl >> shift) | (cube.dr << (24 - shift))) & 0xffffff;
        cube.dr = ((cube.dr >> shift) | (temp << (24 - shift))) & 0xffffff;
    }
    return cube;
}

function circle(arr, ...indices) {
    const length = indices.length;
    const temp = arr[indices[length - 1]];
    for (let i = length - 1; i > 0; i--) arr[indices[i]] = arr[indices[i - 1]];
    arr[indices[0]] = temp;
    return arr;
}

function bitCount(value) {
    value -= (value >> 1) & 0x55555555;
    value = ((value >> 2) & 0x33333333) + (value & 0x33333333);
    value = ((value >> 4) + value) & 0x0f0f0f0f;
    value += value >> 8;
    value += value >> 16;
    return value & 0x3f;
}

function binarySearch(sorted, key) {
    let low = 0;
    let high = sorted.length - 1;
    while (low <= high) {
        const mid = low + ((high - low) >> 1);
        const value = sorted[mid];
        if (value < key) low = mid + 1;
        else if (value > key) high = mid - 1;
        else return mid;
    }
    return -low - 1;
}

// ---------- 形状表 ----------

let Shape_ShapeIdx = null;
let ShapePrun = null;
let Shape_TopMove = null;
let Shape_BottomMove = null;
let Shape_TwistMove = null;

function shapeGetShape2Idx(shape) {
    return (binarySearch(Shape_ShapeIdx, shape & 0xffffff) << 1) | (shape >> 24);
}

function shapeSetIdx(shape, index) {
    shape.parity = index & 1;
    shape.top = Shape_ShapeIdx[index >> 1];
    shape.bottom = shape.top & 4095;
    shape.top >>= 12;
}

function shapeGetIdx(shape) {
    return (binarySearch(Shape_ShapeIdx, (shape.top << 12) | shape.bottom) << 1) | shape.parity;
}

function shapeTopMove(shape) {
    let move = 0;
    let moveParity = 0;
    do {
        if ((shape.top & 2048) === 0) {
            move += 1;
            shape.top = shape.top << 1;
        } else {
            move += 2;
            shape.top = (shape.top << 2) ^ 12291;
        }
        moveParity = 1 - moveParity;
    } while ((bitCount(shape.top & 63) & 1) !== 0);
    if ((bitCount(shape.top) & 2) === 0) shape.parity ^= moveParity;
    return move;
}

function shapeBottomMove(shape) {
    let move = 0;
    let moveParity = 0;
    do {
        if ((shape.bottom & 2048) === 0) {
            move += 1;
            shape.bottom = shape.bottom << 1;
        } else {
            move += 2;
            shape.bottom = (shape.bottom << 2) ^ 12291;
        }
        moveParity = 1 - moveParity;
    } while ((bitCount(shape.bottom & 63) & 1) !== 0);
    if ((bitCount(shape.bottom) & 2) === 0) shape.parity ^= moveParity;
    return move;
}

function initShapeTables() {
    if (Shape_ShapeIdx) return;

    Shape_ShapeIdx = [];
    let count = 0;
    for (let i = 0; i < 28561; i++) {
        const dr = SHAPE_HALFLAYER[i % 13];
        const dl = SHAPE_HALFLAYER[Math.floor(i / 13) % 13];
        const ur = SHAPE_HALFLAYER[Math.floor(i / 169) % 13];
        const ul = SHAPE_HALFLAYER[Math.floor(i / 2197)];
        const value = (ul << 18) | (ur << 12) | (dl << 6) | dr;
        if (bitCount(value) === 16) Shape_ShapeIdx[count++] = value;
    }
    if (Shape_ShapeIdx.length !== SHAPE_COUNT) {
        throw new Error(`Square-1 形状表数量异常: ${Shape_ShapeIdx.length}`);
    }

    Shape_TopMove = new Int32Array(SHAPE_STATE_COUNT);
    Shape_BottomMove = new Int32Array(SHAPE_STATE_COUNT);
    Shape_TwistMove = new Int32Array(SHAPE_STATE_COUNT);
    ShapePrun = new Int8Array(SHAPE_STATE_COUNT);

    const shape = { top: 0, bottom: 0, parity: 0 };
    for (let i = 0; i < SHAPE_STATE_COUNT; i++) {
        shapeSetIdx(shape, i);
        Shape_TopMove[i] = shapeTopMove(shape) | (shapeGetIdx(shape) << 4);

        shapeSetIdx(shape, i);
        Shape_BottomMove[i] = shapeBottomMove(shape) | (shapeGetIdx(shape) << 4);

        shapeSetIdx(shape, i);
        const temp = shape.top & 63;
        const p1 = bitCount(temp);
        const p3 = bitCount(shape.bottom & 4032);
        shape.parity ^= 1 & ((p1 & p3) >> 1);
        shape.top = (shape.top & 4032) | ((shape.bottom >> 6) & 63);
        shape.bottom = (shape.bottom & 63) | (temp << 6);
        Shape_TwistMove[i] = shapeGetIdx(shape);
    }

    ShapePrun.fill(-1);
    for (const solved of [14378715, 31157686, 23967451, 7191990]) {
        ShapePrun[shapeGetShape2Idx(solved)] = 0;
    }

    let done = 4;
    let done0 = 0;
    let depth = -1;
    while (done !== done0) {
        done0 = done;
        depth++;
        for (let i = 0; i < SHAPE_STATE_COUNT; i++) {
            if (ShapePrun[i] !== depth) continue;

            let m = 0;
            let idx = i;
            do {
                idx = Shape_TopMove[idx];
                m += idx & 15;
                idx >>= 4;
                if (ShapePrun[idx] === -1) {
                    done++;
                    ShapePrun[idx] = depth + 1;
                }
            } while (m !== 12);

            m = 0;
            idx = i;
            do {
                idx = Shape_BottomMove[idx];
                m += idx & 15;
                idx >>= 4;
                if (ShapePrun[idx] === -1) {
                    done++;
                    ShapePrun[idx] = depth + 1;
                }
            } while (m !== 12);

            idx = Shape_TwistMove[i];
            if (ShapePrun[idx] === -1) {
                done++;
                ShapePrun[idx] = depth + 1;
            }
        }
    }
}

// ---------- 排列表 ----------

let SquarePrun = null;
let Square_TwistMove = null;
let Square_TopMove = null;
let Square_BottomMove = null;

function initSquareTables() {
    if (SquarePrun) return;

    Square_TwistMove = new Int32Array(SQUARE_PERM_COUNT);
    Square_TopMove = new Int32Array(SQUARE_PERM_COUNT);
    Square_BottomMove = new Int32Array(SQUARE_PERM_COUNT);

    for (let i = 0; i < SQUARE_PERM_COUNT; i++) {
        let pos = unrankPerm(i, 8);
        circle(pos, 2, 4);
        circle(pos, 3, 5);
        Square_TwistMove[i] = rankPerm(pos);

        pos = unrankPerm(i, 8);
        circle(pos, 0, 3, 2, 1);
        Square_TopMove[i] = rankPerm(pos);

        pos = unrankPerm(i, 8);
        circle(pos, 4, 7, 6, 5);
        Square_BottomMove[i] = rankPerm(pos);
    }

    SquarePrun = new Int8Array(SQUARE_STATE_COUNT);
    SquarePrun.fill(-1);
    SquarePrun[0] = 0;

    let depth = 0;
    let done = 1;
    while (done < SQUARE_STATE_COUNT) {
        const inverse = depth >= 11;
        const find = inverse ? -1 : depth;
        const check = inverse ? depth : -1;
        depth++;

        outer: for (let i = 0; i < SQUARE_STATE_COUNT; i++) {
            if (SquarePrun[i] !== find) continue;

            const idx = i >> 1;
            const ml = i & 1;

            let idx2 = (Square_TwistMove[idx] << 1) | (1 - ml);
            if (SquarePrun[idx2] === check) {
                done++;
                SquarePrun[inverse ? i : idx2] = depth;
                if (inverse) continue outer;
            }

            idx2 = idx;
            for (let m = 0; m < 4; m++) {
                idx2 = Square_TopMove[idx2];
                const target = (idx2 << 1) | ml;
                if (SquarePrun[target] === check) {
                    done++;
                    SquarePrun[inverse ? i : target] = depth;
                    if (inverse) continue outer;
                }
            }

            for (let m = 0; m < 4; m++) {
                idx2 = Square_BottomMove[idx2];
                const target = (idx2 << 1) | ml;
                if (SquarePrun[target] === check) {
                    done++;
                    SquarePrun[inverse ? i : target] = depth;
                    if (inverse) continue outer;
                }
            }
        }
    }
}

// ---------- 完整状态 ----------

function fullCubeGetParity(cube) {
    const arr = [pieceAt(cube, 0)];
    let count = 0;
    for (let i = 1; i < 24; i++) {
        if (pieceAt(cube, i) !== arr[count]) arr[++count] = pieceAt(cube, i);
    }
    let parity = 0;
    for (let a = 0; a < 16; a++) {
        for (let b = a + 1; b < 16; b++) {
            if (arr[a] > arr[b]) parity ^= 1;
        }
    }
    return parity;
}

function halfLayerBits(value) {
    let bits = value & 0x111111;
    bits |= bits >> 3;
    bits |= bits >> 6;
    bits = (bits & 15) | ((bits >> 12) & 48);
    return bits;
}

function fullCubeGetShapeIdx(cube) {
    return shapeGetShape2Idx(
        (fullCubeGetParity(cube) << 24) |
            (halfLayerBits(cube.ul) << 18) |
            (halfLayerBits(cube.ur) << 12) |
            (halfLayerBits(cube.dl) << 6) |
            halfLayerBits(cube.dr)
    );
}

function fullCubeGetSquare(cube, square) {
    const prm = [];
    for (let a = 0; a < 8; a++) prm[a] = pieceAt(cube, a * 3 + 1) >> 1;
    square.cornperm = rankPerm(prm);

    square.topEdgeFirst = pieceAt(cube, 0) === pieceAt(cube, 1);
    let a = square.topEdgeFirst ? 2 : 0;
    let b = 0;
    for (; b < 4; a += 3, b++) prm[b] = pieceAt(cube, a) >> 1;

    square.botEdgeFirst = pieceAt(cube, 12) === pieceAt(cube, 13);
    a = square.botEdgeFirst ? 14 : 12;
    for (; b < 8; a += 3, b++) prm[b] = pieceAt(cube, a) >> 1;

    square.edgeperm = rankPerm(prm);
    square.ml = cube.ml;
}

export function randomCube(randomInt = Math.random) {
    initShapeTables();
    const index = Math.floor(randomInt(SHAPE_COUNT));
    const cube = newCube();
    const shape = Shape_ShapeIdx[index];

    let corner = (0x01234567 << 1) | 0x11111111;
    let edge = 0x01234567 << 1;
    let nCorner = 8;
    let nEdge = 8;

    for (let i = 0; i < 24; i++) {
        if (((shape >> i) & 1) === 0) {
            const rnd = Math.floor(randomInt(nEdge)) << 2;
            setPiece(cube, 23 - i, (edge >> rnd) & 0xf);
            const mask = (1 << rnd) - 1;
            edge = (edge & mask) + ((edge >> 4) & ~mask);
            nEdge--;
        } else {
            const rnd = Math.floor(randomInt(nCorner)) << 2;
            setPiece(cube, 23 - i, (corner >> rnd) & 0xf);
            setPiece(cube, 22 - i, (corner >> rnd) & 0xf);
            const mask = (1 << rnd) - 1;
            corner = (corner & mask) + ((corner >> 4) & ~mask);
            nCorner--;
            i++;
        }
    }

    cube.ml = randomInt(2);
    return cube;
}

// ---------- 两阶段搜索 ----------

function createSearchState() {
    return {
        move: [],
        d: newCube(),
        sq: { cornperm: 0, edgeperm: 0, ml: 0, topEdgeFirst: false, botEdgeFirst: false },
        c: null,
        length1: 0,
        maxlen2: 0,
        solutionLength: 0,
        solString: null,
    };
}

function searchMoveToString(search, length) {
    let result = "";
    let top = 0;
    let bottom = 0;

    for (let i = length - 1; i >= 0; i--) {
        let value = search.move[i];
        if (value > 0) {
            value = 12 - value;
            top = value > 6 ? value - 12 : value;
        } else if (value < 0) {
            value = 12 + value;
            bottom = value > 6 ? value - 12 : value;
        } else {
            const twist = "/";
            if (top === 0 && bottom === 0) {
                result += twist;
            } else {
                result += ` (${top},${bottom})${twist}`;
            }
            top = 0;
            bottom = 0;
        }
    }
    if (top !== 0 || bottom !== 0) result += ` (${top},${bottom})`;
    return result;
}

function searchPhase2(search, edge, corner, topEdgeFirst, botEdgeFirst, ml, maxl, depth, lastMove) {
    if (maxl === 0 && !topEdgeFirst && botEdgeFirst) return true;

    if (lastMove !== 0 && topEdgeFirst === botEdgeFirst) {
        const edge2 = Square_TwistMove[edge];
        const corner2 = Square_TwistMove[corner];
        if (SquarePrun[(edge2 << 1) | (1 - ml)] < maxl && SquarePrun[(corner2 << 1) | (1 - ml)] < maxl) {
            search.move[depth] = 0;
            if (searchPhase2(search, edge2, corner2, topEdgeFirst, botEdgeFirst, 1 - ml, maxl - 1, depth + 1, 0)) {
                return true;
            }
        }
    }

    if (lastMove <= 0) {
        let topEdgeFirst2 = !topEdgeFirst;
        let edge2 = topEdgeFirst2 ? Square_TopMove[edge] : edge;
        let corner2 = topEdgeFirst2 ? corner : Square_TopMove[corner];
        let m = topEdgeFirst2 ? 1 : 2;
        let prun1 = SquarePrun[(edge2 << 1) | ml];
        let prun2 = SquarePrun[(corner2 << 1) | ml];

        while (m < 12 && prun1 <= maxl && prun2 <= maxl) {
            if (prun1 < maxl && prun2 < maxl) {
                search.move[depth] = m;
                if (searchPhase2(search, edge2, corner2, topEdgeFirst2, botEdgeFirst, ml, maxl - 1, depth + 1, 1)) {
                    return true;
                }
            }
            topEdgeFirst2 = !topEdgeFirst2;
            if (topEdgeFirst2) {
                edge2 = Square_TopMove[edge2];
                prun1 = SquarePrun[(edge2 << 1) | ml];
                m += 1;
            } else {
                corner2 = Square_TopMove[corner2];
                prun2 = SquarePrun[(corner2 << 1) | ml];
                m += 2;
            }
        }
    }

    if (lastMove <= 1) {
        let botEdgeFirst2 = !botEdgeFirst;
        let edge2 = botEdgeFirst2 ? Square_BottomMove[edge] : edge;
        let corner2 = botEdgeFirst2 ? corner : Square_BottomMove[corner];
        let m = botEdgeFirst2 ? 1 : 2;
        let prun1 = SquarePrun[(edge2 << 1) | ml];
        let prun2 = SquarePrun[(corner2 << 1) | ml];

        while (m < (maxl > 6 ? 6 : 12) && prun1 <= maxl && prun2 <= maxl) {
            if (prun1 < maxl && prun2 < maxl) {
                search.move[depth] = -m;
                if (searchPhase2(search, edge2, corner2, topEdgeFirst, botEdgeFirst2, ml, maxl - 1, depth + 1, 2)) {
                    return true;
                }
            }
            botEdgeFirst2 = !botEdgeFirst2;
            if (botEdgeFirst2) {
                edge2 = Square_BottomMove[edge2];
                prun1 = SquarePrun[(edge2 << 1) | ml];
                m += 1;
            } else {
                corner2 = Square_BottomMove[corner2];
                prun2 = SquarePrun[(corner2 << 1) | ml];
                m += 2;
            }
        }
    }

    return false;
}

function searchInit2(search) {
    search.d = copyCube(search.c);
    for (let i = 0; i < search.length1; i++) doMove(search.d, search.move[i]);
    fullCubeGetSquare(search.d, search.sq);

    const edge = search.sq.edgeperm;
    const corner = search.sq.cornperm;
    const ml = search.sq.ml;
    const prun = Math.max(SquarePrun[(edge << 1) | ml], SquarePrun[(corner << 1) | ml]);

    for (let i = prun; i < search.maxlen2; i++) {
        if (searchPhase2(search, edge, corner, search.sq.topEdgeFirst, search.sq.botEdgeFirst, ml, i, search.length1, 0)) {
            for (let j = 0; j < i; j++) doMove(search.d, search.move[search.length1 + j]);
            search.solutionLength = i + search.length1;
            search.solString = searchMoveToString(search, search.solutionLength);
            return true;
        }
    }
    return false;
}

function searchPhase1(search, shape, prunValue, maxl, depth, lastMove) {
    if (prunValue === 0 && maxl < 4) {
        return maxl === 0 && searchInit2(search);
    }

    if (lastMove !== 0) {
        const shape2 = Shape_TwistMove[shape];
        const prun2 = ShapePrun[shape2];
        if (prun2 < maxl) {
            search.move[depth] = 0;
            if (searchPhase1(search, shape2, prun2, maxl - 1, depth + 1, 0)) return true;
        }
    }

    let shape2 = shape;
    if (lastMove <= 0) {
        let m = 0;
        while (true) {
            m += Shape_TopMove[shape2];
            shape2 = m >> 4;
            m &= 15;
            if (m >= 12) break;
            const prun2 = ShapePrun[shape2];
            if (prun2 > maxl) break;
            if (prun2 < maxl) {
                search.move[depth] = m;
                if (searchPhase1(search, shape2, prun2, maxl - 1, depth + 1, 1)) return true;
            }
        }
    }

    shape2 = shape;
    if (lastMove <= 1) {
        let m = 0;
        while (true) {
            m += Shape_BottomMove[shape2];
            shape2 = m >> 4;
            m &= 15;
            if (m >= 6) break;
            const prun2 = ShapePrun[shape2];
            if (prun2 > maxl) break;
            if (prun2 < maxl) {
                search.move[depth] = -m;
                if (searchPhase1(search, shape2, prun2, maxl - 1, depth + 1, 2)) return true;
            }
        }
    }

    return false;
}

function searchSolution(cube) {
    const search = createSearchState();
    search.c = cube;
    const shape = fullCubeGetShapeIdx(cube);

    for (search.length1 = ShapePrun[shape]; search.length1 < 100; search.length1++) {
        search.maxlen2 = Math.min(32 - search.length1, 17);
        search.move = [];
        if (searchPhase1(search, shape, ShapePrun[shape], search.length1, 0, -1)) {
            return search.solString;
        }
    }
    return null;
}

// ---------- 对外接口 ----------

let SQUARE_BUILD_MS = null;

export function initTables() {
    if (SQUARE_BUILD_MS !== null) return { buildMs: SQUARE_BUILD_MS };
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    initShapeTables();
    initSquareTables();
    const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    SQUARE_BUILD_MS = finishedAt - startedAt;
    return { buildMs: SQUARE_BUILD_MS };
}

export function solveCube(cube) {
    initTables();
    return searchSolution(cube);
}

export function getRandomSquareOneScramble(randomInt = Math.random) {
    initTables();
    for (let attempt = 0; attempt < 32; attempt++) {
        const text = searchSolution(randomCube(randomInt));
        if (text && countSlashes(text) >= SQ1_MIN_SLASHES) return text;
    }
    return null;
}

export const SQ1_MIN_MOVES = 11;
export const SQ1_MIN_SLASHES = 11;

// 解析 WCA 记法并作用到状态；用于测试和校验。
function topRotate(cube, units) {
    const amount = ((units % 12) + 12) % 12;
    if (amount !== 0) doMove(cube, amount);
}

function bottomRotate(cube, units) {
    const amount = ((units % 12) + 12) % 12;
    if (amount !== 0) doMove(cube, -amount);
}

export function applyScramble(cube, scramble) {
    let result = copyCube(cube);
    const tokens = String(scramble ?? "").replace(/\//g, " / ").trim().split(/\s+/).filter(Boolean);

    for (const token of tokens) {
        if (token === "/") {
            doMove(result, 0);
            continue;
        }
        const match = /^\((-?\d+),\s*(-?\d+)\)$/.exec(token);
        if (!match) throw new Error(`Square-1 无法解析动作: ${token}`);
        topRotate(result, Number(match[1]));
        bottomRotate(result, Number(match[2]));
    }
    return result;
}

export function invertScramble(scramble) {
    const tokens = String(scramble ?? "").replace(/\//g, " / ").trim().split(/\s+/).filter(Boolean);
    const result = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        if (token === "/") {
            result.push("/");
            continue;
        }
        const match = /^\((-?\d+),\s*(-?\d+)\)$/.exec(token);
        if (!match) throw new Error(`Square-1 无法解析动作: ${token}`);
        result.push(`(${-Number(match[1])},${-Number(match[2])})`);
    }
    return result.join(" ");
}

export function isSolvedCube(cube) {
    const solved = newCube();
    return cubeToString(cube) === cubeToString(solved);
}

export function countSlashes(scramble) {
    return (String(scramble ?? "").match(/\//g) || []).length;
}

export function countMoves(scramble) {
    return String(scramble ?? "").replace(/\//g, " / ").trim().split(/\s+/).filter(Boolean).length;
}
