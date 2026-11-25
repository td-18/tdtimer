// 3x3 块级模型（M1）
//
// 坐标与块顺序沿用 Kociemba/min2phase 的约定：
//   corners: URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
//   edges:   UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
//
// 这里只实现块级乘法和坐标编解码；移动表/剪枝表见 tables.js，
// 搜索见 search.js。

export const N_TWIST = 2187;
export const N_FLIP = 2048;
export const N_SLICE = 495;
export const N_PERM = 40320;
export const N_MPERM = 24;
export const N_MOVE = 18;
export const N_MOVE2 = 10;

// phase 2 允许的 10 个动作对应的全量动作下标
export const PHASE2_MOVES = Object.freeze([0, 1, 2, 9, 10, 11, 4, 7, 13, 16]);

export const MOVE_NAMES = Object.freeze([
    "U", "U2", "U'",
    "R", "R2", "R'",
    "F", "F2", "F'",
    "D", "D2", "D'",
    "L", "L2", "L'",
    "B", "B2", "B'",
]);

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];

// Cnk[n][k]
const CNK = Array.from({ length: 12 }, () => new Array(13).fill(0));
for (let i = 0; i < 12; i++) {
    CNK[i][0] = 1;
    CNK[i][i] = 1;
    CNK[i][i + 1] = 0;
    for (let j = 1; j < i; j++) {
        CNK[i][j] = CNK[i - 1][j - 1] + CNK[i - 1][j];
    }
}

function bitCount(value) {
    let x = value;
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (x + (x >>> 4) + (x >>> 8)) & 0x0f;
}

function bitOdd(value) {
    let x = value;
    x ^= x >>> 1;
    x ^= x >>> 2;
    x ^= x >>> 4;
    x ^= x >>> 8;
    return x & 1;
}

// 8 元排列的 Lehmer 编解码。与 min2phase 的 cperm/eperm 常量保持一致。
export function set8Perm(arr, index) {
    let idx = index;
    let val = 0x76543210;
    for (let i = 0; i < 7; i++) {
        const p = FACT[7 - i];
        const v = Math.floor(idx / p);
        idx %= p;
        const shift = v << 2;
        arr[i] = (val >> shift) & 7;
        const mask = (1 << shift) - 1;
        val = (val & mask) + ((val >> 4) & ~mask);
    }
    arr[7] = val;
}

export function get8Perm(arr) {
    let idx = 0;
    let val = 0x76543210;
    for (let i = 0; i < 7; i++) {
        const shift = arr[i] << 2;
        idx = (8 - i) * idx + ((val >> shift) & 7);
        val -= 0x11111110 << shift;
    }
    return idx;
}

// 12 元排列解码，只用于初始化六个基本动作。
function set12Perm(arr, index) {
    let idx = index;
    arr[11] = 0;
    for (let i = 10; i >= 0; i--) {
        const base = 12 - i;
        arr[i] = idx % base;
        idx = Math.floor(idx / base);
        for (let j = i + 1; j < 12; j++) {
            if (arr[j] >= arr[i]) arr[j]++;
        }
    }
}

export class CubieCube {
    constructor() {
        this.cp = [0, 1, 2, 3, 4, 5, 6, 7];
        this.co = [0, 0, 0, 0, 0, 0, 0, 0];
        this.ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        this.eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    clone() {
        const copy = new CubieCube();
        copy.copyFrom(this);
        return copy;
    }

    copyFrom(other) {
        for (let i = 0; i < 8; i++) {
            this.cp[i] = other.cp[i];
            this.co[i] = other.co[i];
        }
        for (let i = 0; i < 12; i++) {
            this.ep[i] = other.ep[i];
            this.eo[i] = other.eo[i];
        }
    }

    init(cperm, twist, eperm, flip) {
        this.cp = [0, 1, 2, 3, 4, 5, 6, 7];
        this.co = [0, 0, 0, 0, 0, 0, 0, 0];
        this.ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        this.eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        set8Perm(this.cp, cperm);
        setTwist(this, twist);
        set12Perm(this.ep, eperm);
        setFlip(this, flip);
    }
}

// 六个基本动作的坐标常量（来自 Kociemba/min2phase 的标准定义）。
const BASE_MOVES = [
    [15120, 0, 119750400, 0],       // U
    [21021, 1494, 323403417, 0],    // R
    [8064, 1236, 29441808, 802],    // F
    [9, 0, 5880, 0],                // D
    [1230, 412, 2949660, 0],        // L
    [224, 137, 328552, 1160],       // B
];

let MOVE_CUBES = null;

export function getMoveCubes() {
    if (MOVE_CUBES) return MOVE_CUBES;

    const base = BASE_MOVES.map((def) => {
        const cube = new CubieCube();
        cube.init(def[0], def[1], def[2], def[3]);
        return cube;
    });

    const moves = new Array(N_MOVE);
    const scratch = new CubieCube();

    for (let face = 0; face < 6; face++) {
        moves[face * 3] = base[face].clone();
        multiply(moves[face * 3], base[face], scratch);
        moves[face * 3 + 1] = scratch.clone();
        multiply(moves[face * 3 + 1], base[face], scratch);
        moves[face * 3 + 2] = scratch.clone();
    }

    MOVE_CUBES = moves;
    return MOVE_CUBES;
}

// out = a * b
export function multiply(a, b, out) {
    for (let i = 0; i < 8; i++) {
        const p = b.cp[i];
        out.cp[i] = a.cp[p];
        out.co[i] = (a.co[p] + b.co[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
        const p = b.ep[i];
        out.ep[i] = a.ep[p];
        out.eo[i] = a.eo[p] ^ b.eo[i];
    }
    return out;
}

export function moveInto(cube, move, out) {
    return multiply(cube, getMoveCubes()[move], out);
}

export function applyMove(cube, move) {
    return moveInto(cube, move, new CubieCube());
}

export function applyMoves(cube, moves) {
    let current = cube.clone();
    let next = new CubieCube();
    for (let i = 0; i < moves.length; i++) {
        moveInto(current, moves[i], next);
        const tmp = current;
        current = next;
        next = tmp;
    }
    return current;
}

// 逆动作：U <-> U'，U2 <-> U2
export function invertMove(move) {
    const face = Math.floor(move / 3);
    const power = move % 3;
    return face * 3 + (power === 0 ? 2 : power === 2 ? 0 : 1);
}

export function invertMoves(moves) {
    const result = new Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
        result[i] = invertMove(moves[moves.length - 1 - i]);
    }
    return result;
}

// 合并相邻同面动作，返回等价且尽量短的动作序列。
export function simplifyMoves(moves) {
    const out = [];
    let pendingFace = -1;
    let pendingPower = 0;

    const flush = () => {
        if (pendingFace < 0) return;
        const power = pendingPower % 4;
        if (power !== 0) out.push(pendingFace * 3 + (power === 1 ? 0 : power === 2 ? 1 : 2));
        pendingFace = -1;
        pendingPower = 0;
    };

    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const face = Math.floor(move / 3);
        const power = (move % 3) + 1; // 1,2,3
        if (pendingFace === face) {
            pendingPower = (pendingPower + power) % 4;
            if (pendingPower === 0) {
                pendingFace = -1;
                pendingPower = 0;
            }
        } else {
            flush();
            pendingFace = face;
            pendingPower = power;
        }
    }
    flush();
    return out;
}

export function movesToString(moves) {
    return moves.map((move) => MOVE_NAMES[move]).join(" ");
}

export function stringToMoves(text) {
    const map = new Map(MOVE_NAMES.map((name, index) => [name, index]));
    return text.trim().split(/\s+/).filter(Boolean).map((token) => {
        const move = map.get(token);
        if (move === undefined) throw new Error(`未知动作: ${token}`);
        return move;
    });
}

export function getTwist(cube) {
    let idx = 0;
    for (let i = 0; i < 7; i++) {
        idx = idx * 3 + cube.co[i];
    }
    return idx;
}

export function setTwist(cube, index) {
    let idx = index;
    let sum = 0;
    for (let i = 6; i >= 0; i--) {
        const value = idx % 3;
        cube.co[i] = value;
        sum += value;
        idx = Math.floor(idx / 3);
    }
    cube.co[7] = (15 - sum) % 3;
}

export function getFlip(cube) {
    let idx = 0;
    for (let i = 0; i < 11; i++) {
        idx |= cube.eo[i] << i;
    }
    return idx;
}

export function setFlip(cube, index) {
    let idx = index;
    for (let i = 0; i < 11; i++) {
        cube.eo[i] = idx & 1;
        idx >>>= 1;
    }
    cube.eo[11] = bitOdd(index);
}

export function getSlice(cube) {
    let idx = 0;
    let r = 4;
    for (let i = 0; i < 12; i++) {
        if (cube.ep[i] >= 8) {
            idx += CNK[11 - i][r];
            r--;
        }
    }
    return idx;
}

export function setSlice(cube, index) {
    let idx = index;
    let r = 4;
    for (let i = 0; i < 12; i++) {
        if (idx >= CNK[11 - i][r]) {
            idx -= CNK[11 - i][r];
            r--;
            cube.ep[i] = 11 - r;
        } else {
            cube.ep[i] = i + r - 4;
        }
    }
}

export function getCPerm(cube) {
    return get8Perm(cube.cp);
}

export function setCPerm(cube, index) {
    set8Perm(cube.cp, index);
}

export function getEPerm(cube) {
    return get8Perm(cube.ep);
}

export function setEPerm(cube, index) {
    set8Perm(cube.ep, index);
    for (let i = 8; i < 12; i++) cube.ep[i] = i;
}

export function getMPerm(cube) {
    let mask = 1 << cube.ep[11];
    let idx = 0;
    for (let i = 10; i >= 8; i--) {
        const bit = 1 << cube.ep[i];
        idx += bitCount(mask & (bit - 1)) * FACT[11 - i];
        mask |= bit;
    }
    return idx;
}

export function setMPerm(cube, index) {
    let idx = index;
    cube.ep[11] = 8;
    for (let i = 10; i >= 8; i--) {
        const base = 12 - i;
        cube.ep[i] = (idx % base) + 8;
        idx = Math.floor(idx / base);
        for (let j = i + 1; j < 12; j++) {
            if (cube.ep[j] >= cube.ep[i]) cube.ep[j]++;
        }
    }
}

export function cubeCoords(cube) {
    return {
        twist: getTwist(cube),
        flip: getFlip(cube),
        slice: getSlice(cube),
        cperm: getCPerm(cube),
        eperm: getEPerm(cube),
        sperm: getMPerm(cube),
    };
}

export function isSolved(cube) {
    for (let i = 0; i < 8; i++) {
        if (cube.cp[i] !== i || cube.co[i] !== 0) return false;
    }
    for (let i = 0; i < 12; i++) {
        if (cube.ep[i] !== i || cube.eo[i] !== 0) return false;
    }
    return true;
}

export function cubesEqual(a, b) {
    for (let i = 0; i < 8; i++) {
        if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
    }
    for (let i = 0; i < 12; i++) {
        if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
    }
    return true;
}

export function permutationParity(arr) {
    let parity = 0;
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] > arr[j]) parity ^= 1;
        }
    }
    return parity;
}

// 随机合法状态：角/棱排列各随机，朝向和修正，奇偶性不一致时交换两个棱。
export function randomCube(intFn) {
    const int = intFn || ((max) => Math.floor(Math.random() * max));
    const cube = new CubieCube();

    for (let i = cube.cp.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [cube.cp[i], cube.cp[j]] = [cube.cp[j], cube.cp[i]];
    }
    for (let i = cube.ep.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [cube.ep[i], cube.ep[j]] = [cube.ep[j], cube.ep[i]];
    }

    let cornerSum = 0;
    for (let i = 0; i < 7; i++) {
        const value = int(3);
        cube.co[i] = value;
        cornerSum += value;
    }
    cube.co[7] = (3 - (cornerSum % 3)) % 3;

    let edgeSum = 0;
    for (let i = 0; i < 11; i++) {
        const value = int(2);
        cube.eo[i] = value;
        edgeSum += value;
    }
    cube.eo[11] = edgeSum & 1;

    if (permutationParity(cube.cp) !== permutationParity(cube.ep)) {
        [cube.ep[0], cube.ep[1]] = [cube.ep[1], cube.ep[0]];
    }

    return cube;
}
