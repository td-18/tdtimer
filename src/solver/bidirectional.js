// 公式候选生成：双向 BFS（meet in the middle）
//
// 只读复用 333 的块模型（cubie.js），不改动打乱 / 求解的现有实现。
//
// 思路：
//   - 反向从目标集合（默认复原态）出发，宽度搜索 backwardDepth 层；
//   - 正向从案例状态出发，宽度搜索 forwardDepth 层；
//   - 两侧相遇即得一条解，长度不超过 forwardDepth + backwardDepth。
//
// 预算按“单侧”计算，且只在层边界停止：
// 加动作会放大分支数，如果两侧共享一个总预算，先跑的一侧会把预算吃光，
// 另一侧直接跳过，结果反而变少（这不是“更多动作更好”该有的行为）。
//
// 注意：搜索的中间态会打散 F2L，所以不能只在“最后一层状态”上搜；
// 这里搜的是完整魔方状态，靠双向把 18^10 压成 2 × 15^5。

import {
    CubieCube,
    invertMove,
    moveInto,
    movesToString,
} from "../scramble/wca/puzzles/333/cubie.js";
import { faceOf, resolveMoveSet, simplifyToFixed } from "./moveset.js";

const CORNER_SLOTS = 8;
const EDGE_SLOTS = 12;

// 40 个字符唯一编码一个状态：前 8 个是角块（下标*3+朝向），后 12 个是棱块（下标*2+朝向）
export function encodeCube(cube) {
    let text = "";
    for (let i = 0; i < CORNER_SLOTS; i++) text += String.fromCharCode(cube.cp[i] * 4 + cube.co[i]);
    for (let i = 0; i < EDGE_SLOTS; i++) text += String.fromCharCode(cube.ep[i] * 2 + cube.eo[i]);
    return text;
}

class StatePool {
    constructor(capacity = 1 << 12) {
        this.size = 0;
        this.capacity = 0;
        this.cp = this.co = this.ep = this.eo = null;
        this.parent = this.move = this.depth = null;
        this.reserve(capacity);
    }

    reserve(capacity) {
        if (capacity <= this.capacity) return;
        const cp = new Uint8Array(capacity * CORNER_SLOTS);
        const co = new Uint8Array(capacity * CORNER_SLOTS);
        const ep = new Uint8Array(capacity * EDGE_SLOTS);
        const eo = new Uint8Array(capacity * EDGE_SLOTS);
        const parent = new Int32Array(capacity);
        const move = new Int16Array(capacity);
        const depth = new Uint8Array(capacity);
        if (this.cp) {
            cp.set(this.cp);
            co.set(this.co);
            ep.set(this.ep);
            eo.set(this.eo);
            parent.set(this.parent);
            move.set(this.move);
            depth.set(this.depth);
        }
        this.cp = cp;
        this.co = co;
        this.ep = ep;
        this.eo = eo;
        this.parent = parent;
        this.move = move;
        this.depth = depth;
        this.capacity = capacity;
    }

    add(cube, parent, move, depth) {
        if (this.size === this.capacity) this.reserve(this.capacity * 2);
        const index = this.size++;
        const c8 = index * CORNER_SLOTS;
        const e12 = index * EDGE_SLOTS;
        for (let i = 0; i < CORNER_SLOTS; i++) {
            this.cp[c8 + i] = cube.cp[i];
            this.co[c8 + i] = cube.co[i];
        }
        for (let i = 0; i < EDGE_SLOTS; i++) {
            this.ep[e12 + i] = cube.ep[i];
            this.eo[e12 + i] = cube.eo[i];
        }
        this.parent[index] = parent;
        this.move[index] = move;
        this.depth[index] = depth;
        return index;
    }

    copyInto(index, cube) {
        const c8 = index * CORNER_SLOTS;
        const e12 = index * EDGE_SLOTS;
        for (let i = 0; i < CORNER_SLOTS; i++) {
            cube.cp[i] = this.cp[c8 + i];
            cube.co[i] = this.co[c8 + i];
        }
        for (let i = 0; i < EDGE_SLOTS; i++) {
            cube.ep[i] = this.ep[e12 + i];
            cube.eo[i] = this.eo[e12 + i];
        }
        return cube;
    }

    key(index) {
        const c8 = index * CORNER_SLOTS;
        const e12 = index * EDGE_SLOTS;
        let text = "";
        for (let i = 0; i < CORNER_SLOTS; i++) text += String.fromCharCode(this.cp[c8 + i] * 4 + this.co[c8 + i]);
        for (let i = 0; i < EDGE_SLOTS; i++) text += String.fromCharCode(this.ep[e12 + i] * 2 + this.eo[e12 + i]);
        return text;
    }
}

// 从节点回溯到根，返回“节点 -> 根”方向的解序列
function pathToRoot(pool, index) {
    const moves = [];
    let current = index;
    while (current >= 0) {
        const move = pool.move[current];
        if (move >= 0) moves.push(move);
        current = pool.parent[current];
    }
    return moves;
}

export function findSolutions(startCube, options = {}) {
    const moveList = options.moves || resolveMoveSet();
    const forwardDepth = options.forwardDepth ?? 5;
    const backwardDepth = options.backwardDepth ?? 5;
    // 单侧节点预算；两侧各一份，避免一侧把另一侧饿死
    const budget = options.maxNodesPerSide ?? 1200000;
    const hardCap = Math.floor(budget * 1.6);
    const deadlineMs = options.deadlineMs ?? 60000;
    const deadline = Date.now() + deadlineMs;
    const targets = options.targets && options.targets.length ? options.targets : [new CubieCube()];
    const onLevel = options.onLevel;

    const scratchA = new CubieCube();
    const scratchB = new CubieCube();
    let reachedDeadline = false;

    // ---- 反向：目标集合 -> 案例方向 ----
    const backward = new StatePool(1 << 12);
    const backwardIndex = new Map();
    let frontier = [];
    for (const target of targets) {
        const index = backward.add(target, -1, -1, 0);
        backwardIndex.set(backward.key(index), index);
        frontier.push(index);
    }

    let backwardReached = 0;
    let backwardPartial = false;
    for (let depth = 1; depth <= backwardDepth && frontier.length; depth++) {
        // 层边界：只有整层放得下才开始，避免半层数据让结果不可复现
        if (backward.size >= budget || Date.now() > deadline) {
            reachedDeadline = reachedDeadline || Date.now() > deadline;
            break;
        }
        const next = [];
        let stopped = false;
        for (let f = 0; f < frontier.length; f++) {
            if (backward.size >= hardCap) {
                stopped = true;
                break;
            }
            const index = frontier[f];
            backward.copyInto(index, scratchA);
            const last = backward.move[index];
            for (const move of moveList) {
                // 同面连续没有意义（会互相抵消），直接跳过
                if (last >= 0 && faceOf(last) === faceOf(move)) continue;
                // 反向搜索用逆动作，这样回溯出来的就是解的后缀
                moveInto(scratchA, invertMove(move), scratchB);
                const key = encodeCube(scratchB);
                if (backwardIndex.has(key)) continue;
                const child = backward.add(scratchB, index, move, depth);
                backwardIndex.set(key, child);
                next.push(child);
            }
        }
        frontier = next;
        backwardReached = depth;
        backwardPartial = stopped;
        if (onLevel) onLevel("backward", depth, backward.size, next.length);
        if (stopped) break;
    }

    // ---- 正向：案例 -> 目标 ----
    const forward = new StatePool(1 << 12);
    const visited = new Set();
    const rootKey = encodeCube(startCube);
    const root = forward.add(startCube, -1, -1, 0);
    visited.add(rootKey);

    const found = new Map();
    const record = (forwardIndex, backwardIndexAt) => {
        const prefix = pathToRoot(forward, forwardIndex).reverse();
        const suffix = pathToRoot(backward, backwardIndexAt);
        const raw = prefix.concat(suffix);
        const moves = simplifyToFixed(raw);
        if (!moves.length) return;
        const text = movesToString(moves);
        if (!found.has(text)) found.set(text, { moves, depth: moves.length });
    };

    if (backwardIndex.has(rootKey)) record(root, backwardIndex.get(rootKey));

    let forwardReached = 0;
    let forwardPartial = false;
    let queue = [root];
    for (let depth = 1; depth <= forwardDepth && queue.length; depth++) {
        if (forward.size >= budget || Date.now() > deadline) {
            reachedDeadline = reachedDeadline || Date.now() > deadline;
            break;
        }
        const next = [];
        let stopped = false;
        for (let f = 0; f < queue.length; f++) {
            if (forward.size >= hardCap) {
                stopped = true;
                break;
            }
            const index = queue[f];
            forward.copyInto(index, scratchA);
            const last = forward.move[index];
            for (const move of moveList) {
                if (last >= 0 && faceOf(last) === faceOf(move)) continue;
                moveInto(scratchA, move, scratchB);
                const key = encodeCube(scratchB);
                if (visited.has(key)) continue;
                visited.add(key);
                const child = forward.add(scratchB, index, move, depth);
                const meet = backwardIndex.get(key);
                if (meet !== undefined) record(child, meet);
                next.push(child);
            }
        }
        queue = next;
        forwardReached = depth;
        forwardPartial = stopped;
        if (onLevel) onLevel("forward", depth, forward.size, next.length);
        if (stopped) break;
    }

    const solutions = [...found.values()].sort((a, b) => a.depth - b.depth);

    return {
        solutions,
        stats: {
            forwardNodes: forward.size,
            backwardNodes: backward.size,
            forwardReached,
            backwardReached,
            forwardPartial,
            backwardPartial,
            deadlineHit: reachedDeadline,
            truncated: forwardPartial || backwardPartial || reachedDeadline
                || forwardReached < forwardDepth || backwardReached < backwardDepth,
            meetings: found.size,
            forwardDepth,
            backwardDepth,
            moveCount: moveList.length,
            budgetPerSide: budget,
        },
    };
}
