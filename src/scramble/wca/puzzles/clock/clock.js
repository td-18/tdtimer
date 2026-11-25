// Clock 状态模型 + 随机状态生成器（M2）
//
// Clock 的 14 个独立表盘可以看作 Z/12Z 上的线性空间。每个动作
// （UR/DR/DL/UL/U/R/D/L/ALL，正面/背面各一套）就是对部分表盘
// 加上一个固定向量。随机状态 = 在 18 个动作向量里选一组基，
// 解 14 元线性方程组（mod 12），把随机状态表示成一条动作序列，
// 并选非零动作最少的一组。
//
// 算法结构参考公开的 Clock 线性代数求解思路，代码为本地重写。

export const DIAL_COUNT = 14;
export const CLICKS = 12;
export const TURN_NAMES = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];

// 前 9 个是正面动作，后 9 个是 y2 之后的背面动作。
export const MOVE_VECTORS = Object.freeze([
    Object.freeze([0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]), // UR
    Object.freeze([0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]), // DR
    Object.freeze([0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0]), // DL
    Object.freeze([1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // UL
    Object.freeze([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]), // U
    Object.freeze([0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]), // R
    Object.freeze([0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]), // D
    Object.freeze([1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0]), // L
    Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]), // ALL
    Object.freeze([11, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0]), // UR (back)
    Object.freeze([0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 1, 1, 1]), // DR (back)
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 1, 1, 0, 1]), // DL (back)
    Object.freeze([0, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0]), // UL (back)
    Object.freeze([11, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0]), // U (back)
    Object.freeze([11, 0, 0, 0, 0, 0, 11, 0, 0, 1, 0, 1, 1, 1]), // R (back)
    Object.freeze([0, 0, 0, 0, 0, 0, 11, 0, 11, 0, 1, 1, 1, 1]), // D (back)
    Object.freeze([0, 0, 11, 0, 0, 0, 0, 0, 11, 1, 1, 1, 0, 1]), // L (back)
    Object.freeze([11, 0, 11, 0, 0, 0, 11, 0, 11, 1, 1, 1, 1, 1]), // ALL (back)
]);

export const STATE_COUNT = 12 ** DIAL_COUNT;
export const MIN_MOVES = 2;

const INVERT = [-1, 1, -1, -1, -1, 5, -1, 7, -1, -1, -1, 11];

// 18 个动作里线性相关的组合；求解时跳过。
const LINEAR_DEPENDENT = [7695, 42588, 47187, 85158, 86697, 156568, 181700, 209201, 231778];

const CNK = [];
for (let n = 0; n <= 18; n++) {
    CNK[n] = [];
    for (let k = 0; k <= 18; k++) CNK[n][k] = 0;
    CNK[n][0] = 1;
    CNK[n][n] = 1;
    for (let k = 1; k < n; k++) CNK[n][k] = CNK[n - 1][k - 1] + CNK[n - 1][k];
}

export function solvedState() {
    return new Array(DIAL_COUNT).fill(0);
}

export function cloneState(state) {
    return state.slice();
}

export function stateKey(state) {
    return state.join(",");
}

export function isSolvedState(state) {
    for (let i = 0; i < DIAL_COUNT; i++) {
        if (state[i] % CLICKS !== 0) return false;
    }
    return true;
}

export function applyMove(state, moveIndex, amount) {
    const vector = MOVE_VECTORS[moveIndex];
    if (!vector) throw new RangeError(`Clock 动作索引越界: ${moveIndex}`);
    const delta = ((amount % CLICKS) + CLICKS) % CLICKS;
    const next = state.slice();
    for (let i = 0; i < DIAL_COUNT; i++) {
        if (vector[i] !== 0) next[i] = (next[i] + vector[i] * delta) % CLICKS;
    }
    return next;
}

export function applySolution(state, solution) {
    let result = state.slice();
    for (let i = 0; i < solution.length; i++) {
        if (solution[i] !== 0) result = applyMove(result, i, solution[i]);
    }
    return result;
}

function addTo(matrix, row1, row2, startIndex, multiplier) {
    const length = matrix[0].length;
    for (let i = startIndex; i < length; i++) {
        matrix[row2][i] = (matrix[row2][i] + matrix[row1][i] * multiplier) % CLICKS;
    }
}

function swapRows(matrix, row1, row2) {
    const temp = matrix[row1];
    matrix[row1] = matrix[row2];
    matrix[row2] = temp;
}

// 返回 0 表示满秩；返回正数表示在第几步发现相关；返回 -1 表示无解。
function gaussianElimination(matrix) {
    const rows = DIAL_COUNT;
    const columns = matrix[0].length;

    for (let i = 0; i < columns - 1; i++) {
        if (INVERT[matrix[i][i]] === -1) {
            let pivot = -1;
            for (let j = i + 1; j < rows; j++) {
                if (INVERT[matrix[j][i]] !== -1) {
                    pivot = j;
                    break;
                }
            }
            if (pivot === -1) {
                outer: for (let j1 = i; j1 < rows - 1; j1++) {
                    for (let j2 = j1 + 1; j2 < rows; j2++) {
                        if (INVERT[(matrix[j1][i] + matrix[j2][i]) % CLICKS] !== -1) {
                            addTo(matrix, j2, j1, i, 1);
                            pivot = j1;
                            break outer;
                        }
                    }
                }
            }
            if (pivot === -1) {
                for (let j = i + 1; j < rows; j++) {
                    if (matrix[j][i] !== 0) return -1;
                }
                return i + 1;
            }
            swapRows(matrix, i, pivot);
        }

        const inverse = INVERT[matrix[i][i]];
        for (let j = i; j < columns; j++) {
            matrix[i][j] = (matrix[i][j] * inverse) % CLICKS;
        }
        for (let j = i + 1; j < rows; j++) {
            addTo(matrix, i, j, i, CLICKS - matrix[j][i]);
        }
    }
    return 0;
}

function backSubstitution(matrix) {
    const columns = matrix[0].length;
    for (let i = columns - 2; i > 0; i--) {
        for (let j = i - 1; j >= 0; j--) {
            if (matrix[j][i] !== 0) {
                addTo(matrix, i, j, i, CLICKS - matrix[j][i]);
            }
        }
    }
}

function selectCombination(n, k, index) {
    let remaining = k;
    let value = 0;
    for (let i = n - 1; i >= 0; i--) {
        if (index >= CNK[i][remaining]) {
            index -= CNK[i][remaining];
            remaining--;
            value |= 1 << i;
        }
    }
    return value;
}

// 在 18 个动作里找一个 k 元子集，解出 numbers；返回最少非零动作数。
function solveIn(k, numbers, solution) {
    const n = 18;
    let minNonZero = k + 1;

    for (let idx = 0; idx < CNK[n][k]; idx++) {
        const selection = selectCombination(n, k, idx);

        let dependent = false;
        for (const mask of LINEAR_DEPENDENT) {
            if ((selection & mask) === mask) {
                dependent = true;
                break;
            }
        }
        if (dependent) continue;

        const mapped = [];
        for (let j = 0; j < n; j++) {
            if (((selection >> j) & 1) === 1) mapped.push(j);
        }

        const matrix = [];
        for (let i = 0; i < DIAL_COUNT; i++) {
            const row = new Array(k + 1);
            for (let j = 0; j < k; j++) row[j] = MOVE_VECTORS[mapped[j]][i];
            row[k] = numbers[i];
            matrix.push(row);
        }

        const status = gaussianElimination(matrix);
        if (status !== 0) continue;

        let consistent = true;
        for (let i = k; i < DIAL_COUNT; i++) {
            if (matrix[i][k] !== 0) {
                consistent = false;
                break;
            }
        }
        if (!consistent) continue;

        backSubstitution(matrix);

        let nonZero = 0;
        for (let i = 0; i < k; i++) {
            if (matrix[i][k] !== 0) nonZero++;
        }
        if (nonZero < minNonZero) {
            for (let i = 0; i < 18; i++) solution[i] = 0;
            for (let i = 0; i < k; i++) solution[mapped[i]] = matrix[i][k];
            minNonZero = nonZero;
        }
    }

    return minNonZero === k + 1 ? -1 : minNonZero;
}

// 把 state 表示为 18 个动作的线性组合；返回非零动作数，失败返回 -1。
// 注意：solution 是把复原态变成 state 的序列，不是把 state 解回复原的序列。
export function solveClock(state, solution = new Array(18).fill(0)) {
    if (!Array.isArray(state) || state.length !== DIAL_COUNT) {
        throw new TypeError(`Clock 状态必须是长度 ${DIAL_COUNT} 的数组`);
    }
    return solveIn(DIAL_COUNT, state, solution);
}

function isOneMoveFromSolved(state) {
    if (isSolvedState(state)) return true;
    for (const vector of MOVE_VECTORS) {
        for (let amount = 1; amount < CLICKS; amount++) {
            let equal = true;
            for (let i = 0; i < DIAL_COUNT; i++) {
                if ((vector[i] * amount) % CLICKS !== state[i]) {
                    equal = false;
                    break;
                }
            }
            if (equal) return true;
        }
    }
    return false;
}

function formatTurn(name, value) {
    const clockwise = value <= 6;
    const amount = clockwise ? value : CLICKS - value;
    return `${name}${amount}${clockwise ? "+" : "-"}`;
}

// 把求解系数格式化成 WCA Clock 记法：正面动作 / y2 / 背面动作 / 引脚。
export function formatScramble(solution, randomInt) {
    const front = [];
    const back = [];

    for (let i = 0; i < 9; i++) {
        const value = solution[i];
        if (value !== 0) front.push(formatTurn(TURN_NAMES[i], value));
    }
    for (let i = 0; i < 9; i++) {
        const value = solution[i + 9];
        if (value !== 0) back.push(formatTurn(TURN_NAMES[i], value));
    }

    const parts = [];
    if (front.length) parts.push(front.join(" "));
    parts.push("y2");
    if (back.length) parts.push(back.join(" "));

    const pins = [];
    for (let i = 0; i < 4; i++) {
        if (randomInt(2) === 1) pins.push(TURN_NAMES[i]);
    }
    if (pins.length) parts.push(pins.join(" "));

    return parts.join(" ");
}

const CLOCK_TURN_RE = /^(UR|DR|DL|UL|U|R|D|L|ALL)(\d+)([+-])$/;
const CLOCK_PIN_RE = /^(UR|DR|DL|UL)$/;

// 解析并应用 WCA Clock 打乱；y2 之后的动作使用背面动作向量。
export function applyScramble(state, scramble) {
    let result = state.slice();
    let side = 0;

    for (const token of String(scramble ?? "").trim().split(/\s+/).filter(Boolean)) {
        if (token === "y2") {
            side = 1;
            continue;
        }
        if (CLOCK_PIN_RE.test(token)) continue;

        const match = CLOCK_TURN_RE.exec(token);
        if (!match) throw new Error(`Clock 无法解析动作: ${token}`);
        const turnIndex = TURN_NAMES.indexOf(match[1]);
        const amount = Number(match[2]);
        const signed = match[3] === "+" ? amount : CLICKS - amount;
        result = applyMove(result, turnIndex + side * 9, signed);
    }
    return result;
}

// 生成一个随机状态的可解打乱；返回 null 表示重试。
export function generateClockScramble(randomInt) {
    const state = new Array(DIAL_COUNT);
    for (let i = 0; i < DIAL_COUNT; i++) state[i] = randomInt(CLICKS);

    if (isSolvedState(state)) return null;

    const solution = new Array(18).fill(0);
    const nonZero = solveClock(state, solution);
    if (nonZero < MIN_MOVES) return null;

    // solution 是“复原态 -> 随机状态”的动作序列，必须能复现 state。
    const scrambleState = applySolution(solvedState(), solution);
    for (let i = 0; i < DIAL_COUNT; i++) {
        if (scrambleState[i] !== state[i]) {
            throw new Error("Clock 求解系数没有复现随机状态");
        }
    }
    if (isOneMoveFromSolved(scrambleState)) return null;

    const text = formatScramble(solution, randomInt);
    const replay = applyScramble(solvedState(), text);
    for (let i = 0; i < DIAL_COUNT; i++) {
        if (replay[i] !== scrambleState[i]) {
            throw new Error("Clock 打乱文本与求解系数不一致");
        }
    }

    return {
        text,
        state: scrambleState,
        solution,
        nonZero,
        sourceState: state,
    };
}
