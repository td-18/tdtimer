// 3x3 移动表与剪枝表（M1）
//
// 用 raw 坐标，不做对称压缩：
//   twistMove  2187 x 18
//   flipMove   2048 x 18
//   sliceMove   495 x 18
//   cpermMove 40320 x 10
//   epermMove 40320 x 10
//   spermMove    24 x 10
//
// 剪枝表用 Uint8Array（1 byte/条目），总内存约 4 MB + 队列表约 4 MB。
// M1 优先保证正确性；后续可换成 min2phase 的对称压缩 + 4 bit 存储。

import {
    CubieCube,
    N_FLIP,
    N_MOVE,
    N_MOVE2,
    N_MPERM,
    N_PERM,
    N_SLICE,
    N_TWIST,
    PHASE2_MOVES,
    getCPerm,
    getEPerm,
    getFlip,
    getMPerm,
    getSlice,
    getTwist,
    moveInto,
    setCPerm,
    setEPerm,
    setFlip,
    setMPerm,
    setSlice,
    setTwist,
} from "./cubie.js";

const INF = 255;

let tablesPromise = null;

function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function yieldEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function report(onProgress, table, percent) {
    if (typeof onProgress === "function") {
        onProgress({ phase: "tables", table, percent });
    }
}

function buildTwistMove() {
    const table = new Uint16Array(N_TWIST * N_MOVE);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let twist = 0; twist < N_TWIST; twist++) {
        setTwist(cube, twist);
        const base = twist * N_MOVE;
        for (let move = 0; move < N_MOVE; move++) {
            moveInto(cube, move, scratch);
            table[base + move] = getTwist(scratch);
        }
    }
    return table;
}

function buildFlipMove() {
    const table = new Uint16Array(N_FLIP * N_MOVE);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let flip = 0; flip < N_FLIP; flip++) {
        setFlip(cube, flip);
        const base = flip * N_MOVE;
        for (let move = 0; move < N_MOVE; move++) {
            moveInto(cube, move, scratch);
            table[base + move] = getFlip(scratch);
        }
    }
    return table;
}

function buildSliceMove() {
    const table = new Uint16Array(N_SLICE * N_MOVE);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let slice = 0; slice < N_SLICE; slice++) {
        setSlice(cube, slice);
        const base = slice * N_MOVE;
        for (let move = 0; move < N_MOVE; move++) {
            moveInto(cube, move, scratch);
            table[base + move] = getSlice(scratch);
        }
    }
    return table;
}

function buildCPermMove() {
    const table = new Uint16Array(N_PERM * N_MOVE2);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let perm = 0; perm < N_PERM; perm++) {
        setCPerm(cube, perm);
        const base = perm * N_MOVE2;
        for (let move = 0; move < N_MOVE2; move++) {
            moveInto(cube, PHASE2_MOVES[move], scratch);
            table[base + move] = getCPerm(scratch);
        }
    }
    return table;
}

function buildEPermMove() {
    const table = new Uint16Array(N_PERM * N_MOVE2);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let perm = 0; perm < N_PERM; perm++) {
        setEPerm(cube, perm);
        const base = perm * N_MOVE2;
        for (let move = 0; move < N_MOVE2; move++) {
            moveInto(cube, PHASE2_MOVES[move], scratch);
            table[base + move] = getEPerm(scratch);
        }
    }
    return table;
}

function buildMPermMove() {
    const table = new Uint8Array(N_MPERM * N_MOVE2);
    const cube = new CubieCube();
    const scratch = new CubieCube();
    for (let perm = 0; perm < N_MPERM; perm++) {
        setMPerm(cube, perm);
        const base = perm * N_MOVE2;
        for (let move = 0; move < N_MOVE2; move++) {
            moveInto(cube, PHASE2_MOVES[move], scratch);
            table[base + move] = getMPerm(scratch);
        }
    }
    return table;
}

function buildPrune(size, queue, neighbor, name) {
    const prune = new Uint8Array(size);
    prune.fill(INF);
    prune[0] = 0;

    let head = 0;
    let tail = 1;
    let done = 1;
    queue[0] = 0;

    while (head < tail) {
        const index = queue[head++];
        const depth = prune[index] + 1;
        neighbor(index, depth, (nextIndex) => {
            if (prune[nextIndex] !== INF) return;
            prune[nextIndex] = depth;
            queue[tail++] = nextIndex;
            done++;
        });
    }

    if (done !== size) {
        throw new Error(`${name} 剪枝表未覆盖全部状态: ${done}/${size}`);
    }
    return prune;
}

function buildTwistSlicePrune(twistMove, sliceMove, queue) {
    const size = N_TWIST * N_SLICE;
    return buildPrune(
        size,
        queue,
        (index, depth, visit) => {
            const twist = Math.floor(index / N_SLICE);
            const slice = index - twist * N_SLICE;
            const twistBase = twist * N_MOVE;
            const sliceBase = slice * N_MOVE;
            for (let move = 0; move < N_MOVE; move++) {
                visit(twistMove[twistBase + move] * N_SLICE + sliceMove[sliceBase + move]);
            }
        },
        "twist x slice"
    );
}

function buildFlipSlicePrune(flipMove, sliceMove, queue) {
    const size = N_FLIP * N_SLICE;
    return buildPrune(
        size,
        queue,
        (index, depth, visit) => {
            const flip = Math.floor(index / N_SLICE);
            const slice = index - flip * N_SLICE;
            const flipBase = flip * N_MOVE;
            const sliceBase = slice * N_MOVE;
            for (let move = 0; move < N_MOVE; move++) {
                visit(flipMove[flipBase + move] * N_SLICE + sliceMove[sliceBase + move]);
            }
        },
        "flip x slice"
    );
}

function buildCPermSpermPrune(cpermMove, spermMove, queue) {
    const size = N_PERM * N_MPERM;
    return buildPrune(
        size,
        queue,
        (index, depth, visit) => {
            const cperm = Math.floor(index / N_MPERM);
            const sperm = index - cperm * N_MPERM;
            const cpermBase = cperm * N_MOVE2;
            const spermBase = sperm * N_MOVE2;
            for (let move = 0; move < N_MOVE2; move++) {
                visit(cpermMove[cpermBase + move] * N_MPERM + spermMove[spermBase + move]);
            }
        },
        "cperm x sperm"
    );
}

function buildEPermSpermPrune(epermMove, spermMove, queue) {
    const size = N_PERM * N_MPERM;
    return buildPrune(
        size,
        queue,
        (index, depth, visit) => {
            const eperm = Math.floor(index / N_MPERM);
            const sperm = index - eperm * N_MPERM;
            const epermBase = eperm * N_MOVE2;
            const spermBase = sperm * N_MOVE2;
            for (let move = 0; move < N_MOVE2; move++) {
                visit(epermMove[epermBase + move] * N_MPERM + spermMove[spermBase + move]);
            }
        },
        "eperm x sperm"
    );
}

async function buildTables(onProgress) {
    const startedAt = now();
    const maxQueue = Math.max(N_TWIST * N_SLICE, N_FLIP * N_SLICE, N_PERM * N_MPERM);
    const queue = new Int32Array(maxQueue);

    report(onProgress, "twistMove", 0);
    const twistMove = buildTwistMove();
    report(onProgress, "twistMove", 100);

    report(onProgress, "flipMove", 0);
    const flipMove = buildFlipMove();
    report(onProgress, "flipMove", 100);

    report(onProgress, "sliceMove", 0);
    const sliceMove = buildSliceMove();
    report(onProgress, "sliceMove", 100);

    report(onProgress, "cpermMove", 0);
    const cpermMove = buildCPermMove();
    report(onProgress, "cpermMove", 100);

    report(onProgress, "epermMove", 0);
    const epermMove = buildEPermMove();
    report(onProgress, "epermMove", 100);

    report(onProgress, "spermMove", 0);
    const spermMove = buildMPermMove();
    report(onProgress, "spermMove", 100);

    await yieldEventLoop();

    report(onProgress, "twistSlice", 0);
    const twistSlice = buildTwistSlicePrune(twistMove, sliceMove, queue);
    report(onProgress, "twistSlice", 100);

    await yieldEventLoop();

    report(onProgress, "flipSlice", 0);
    const flipSlice = buildFlipSlicePrune(flipMove, sliceMove, queue);
    report(onProgress, "flipSlice", 100);

    await yieldEventLoop();

    report(onProgress, "cpermSperm", 0);
    const cpermSperm = buildCPermSpermPrune(cpermMove, spermMove, queue);
    report(onProgress, "cpermSperm", 100);

    await yieldEventLoop();

    report(onProgress, "epermSperm", 0);
    const epermSperm = buildEPermSpermPrune(epermMove, spermMove, queue);
    report(onProgress, "epermSperm", 100);

    report(onProgress, "done", 100);

    return {
        twistMove,
        flipMove,
        sliceMove,
        cpermMove,
        epermMove,
        spermMove,
        twistSlice,
        flipSlice,
        cpermSperm,
        epermSperm,
        buildMs: now() - startedAt,
    };
}

export function getTables(onProgress) {
    if (!tablesPromise) {
        tablesPromise = buildTables(onProgress).catch((error) => {
            tablesPromise = null;
            throw error;
        });
    }
    return tablesPromise;
}

export function resetTables() {
    tablesPromise = null;
}
