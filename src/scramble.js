// 打乱：cubing.js 动态加载 + 本地降级
import { state, fData } from "./state.js";
import { getScrambleService } from "./scramble/wca/index.js";
import { settleWithin } from "./loadGuard.js";
import { decorateTwistyElement } from "./twistyView.js";

let randomScrambleForEvent = null;
let libFailed = false;
let libSettled = false;
let preloaded = null;
let preloadedPuzzle = null;
let loading = null;
// 打乱请求序号：切换魔方/连点 next 时丢弃过期结果
let genToken = 0;

// 333 / 222 / Pyraminx / Skewb 由本地 worker 生成，其余项目走 cubing.js。
const localPrefetch = new Map();
const localPrefetchPromises = new Map();

const $ = (id) => document.getElementById(id);

export function hasCubingLib() {
    return !!randomScrambleForEvent && !libFailed;
}

// 加载 cubing.js 的打乱器；失败则走本地兜底打乱
export function loadCubing() {
    if (loading) return loading;
    loading = (async () => {
        try {
            const scrambleMod = await settleWithin(
                import("https://cdn.cubing.net/v0/js/cubing/scramble"),
                5000,
                "cubing.js 打乱器"
            );
            randomScrambleForEvent = scrambleMod.randomScrambleForEvent;
            if (!randomScrambleForEvent) libFailed = true;
        } catch (e) {
            console.log("cubing.js 加载失败，使用本地打乱", e);
            libFailed = true;
        } finally {
            libSettled = true;
        }
        // 本地已接管的项目不需要因为 cubing.js 加载完再重生成一次；
        // 但如果本地失败后停在占位文案，则借 cubing.js 加载完成重试。
        const placeholder = document.getElementById("scrambleText").textContent;
        if (
            !getLocalEventId(state.puzzle) ||
            placeholder === "打乱加载中..." ||
            placeholder === "打乱暂不可用"
        ) {
            await genScr();
        }
    })();
    return loading;
}

export function resetScrambleCache() {
    preloaded = null;
    preloadedPuzzle = null;
    localPrefetch.clear();
    localPrefetchPromises.clear();
}

function getLocalEventId(puzzle) {
    if (!puzzle) return null;
    return puzzle.local || null;
}

async function requestLocal(eventId, onProgress) {
    const result = await getScrambleService().generate(eventId, {
        timeoutMs: 30000,
        maxTotal: 21,
        timeLimitMs: 1200,
        onProgress,
    });
    return result.scrambles[0];
}

// 生成完当前打乱后预取下一把，避免连点 next 时重复建表/重复求解。
function prefetchLocal(puzzle) {
    const eventId = getLocalEventId(puzzle);
    if (!eventId || state.trainMode) return;

    const puzzleKey = puzzle.key;
    if (localPrefetch.has(puzzleKey) || localPrefetchPromises.has(puzzleKey)) return;

    const promise = (async () => {
        try {
            const text = await requestLocal(eventId);
            if (!state.trainMode && getLocalEventId(state.puzzle) === eventId && state.puzzle.key === puzzleKey) {
                localPrefetch.set(puzzleKey, text);
            }
        } catch (e) {
            console.log(`本地 ${eventId} 预取失败`, e);
        } finally {
            // 只清理自己；切换项目后可能已经开始了新的预取。
            if (localPrefetchPromises.get(puzzleKey) === promise) {
                localPrefetchPromises.delete(puzzleKey);
            }
        }
    })();

    localPrefetchPromises.set(puzzleKey, promise);
}

// 计时期间预取下一把（由 timer.js 在开始计时时调用）。
// 放在计时中做，是为了不和「准备阶段」的交互抢主线程/带宽；
// 用户解完停表时 genScr() 直接命中缓存，看起来是瞬时的。
export function prefetchNextScramble() {
    if (state.trainMode) return;
    const puzzle = state.puzzle;
    if (!puzzle || !getLocalEventId(puzzle)) return;
    prefetchLocal(puzzle);
}

// 项目被选中时只加载该项目的实现体（不生成打乱）。
// 这样 11 个 provider 不必在首条打乱前一起下载，切项目才付该项目的成本。
export function preloadLocalProvider(puzzle) {
    const eventId = getLocalEventId(puzzle);
    if (!eventId) return Promise.resolve(false);
    return getScrambleService()
        .init(eventId, { timeoutMs: 30000 })
        .then(() => true)
        .catch((e) => {
            console.log(`本地 ${eventId} 预热失败`, e);
            return false;
        });
}

async function takeLocal(puzzle, token, onProgress) {
    const eventId = getLocalEventId(puzzle);
    if (!eventId) return null;

    const puzzleKey = puzzle.key;
    if (localPrefetch.has(puzzleKey)) {
        const text = localPrefetch.get(puzzleKey);
        localPrefetch.delete(puzzleKey);
        return text;
    }

    const pending = localPrefetchPromises.get(puzzleKey);
    if (pending) {
        await pending;
        if (token !== genToken) return null;
        if (localPrefetch.has(puzzleKey)) {
            const text = localPrefetch.get(puzzleKey);
            localPrefetch.delete(puzzleKey);
            return text;
        }
    }

    try {
        return await requestLocal(eventId, onProgress);
    } catch (e) {
        console.log(`本地 ${eventId} 生成失败，回退旧路径`, e);
        return null;
    }
}

function setPuzzle(puzzleKey) {
    const cube = $("scrambleCube");
    if (cube && puzzleKey) cube.setAttribute("puzzle", puzzleKey);
}

function setScramble(text, fallback, puzzleKey) {
    const cube = $("scrambleCube");
    const warn = $("warnMsg");
    state.scramble = text;
    $("scrambleText").textContent = text;
    if (cube) {
        // 先设置 puzzle 再设置 alg，避免切换项目后残留上一把的算法
        if (puzzleKey) cube.setAttribute("puzzle", puzzleKey);
        cube.setAttribute("alg", text);
        decorateTwistyElement(cube, { puzzle: puzzleKey, alg: text, label: "打乱状态" });
    }
    warn.style.display = fallback ? "block" : "none";
    if (fallback) warn.textContent = "⚠️ 降级：本地打乱";
}

function showOffline(puzzleKey) {
    const cube = $("scrambleCube");
    state.scramble = "";
    $("scrambleText").textContent = "打乱暂不可用";
    $("warnMsg").style.display = "block";
    $("warnMsg").textContent = "⚠️ 该项目打乱需要加载 cubing.js，请检查网络后重试";
    if (cube) {
        if (puzzleKey) cube.setAttribute("puzzle", puzzleKey);
        cube.removeAttribute("alg");
        decorateTwistyElement(cube, { puzzle: puzzleKey, alg: "", label: "打乱状态" });
    }
}

async function prefetch() {
    if (!hasCubingLib() || state.trainMode || getLocalEventId(state.puzzle)) return;
    const puzzle = state.puzzle;
    const legacyEventId = puzzle.legacyEventId || puzzle.eventId;
    const token = genToken;
    try {
        const a = await randomScrambleForEvent(legacyEventId);
        if (token !== genToken || state.trainMode) return;
        preloaded = a.toString();
        preloadedPuzzle = puzzle.key;
    } catch (e) {
        console.log("预取失败", e);
    }
}

export async function genScr() {
    const token = ++genToken;

    const puzzle = state.puzzle;
    const puzzleKey = puzzle.puzzle || puzzle.key;
    const legacyEventId = puzzle.legacyEventId || puzzle.eventId;

    // 333 / 222 / Pyraminx / Skewb 优先用本地 worker；失败再落到 cubing.js / 本地兜底。
    if (getLocalEventId(puzzle)) {
        $("scrambleText").textContent = "生成中...";
        $("warnMsg").style.display = "none";
        const local = await takeLocal(puzzle, token, (data) => {
            if (token !== genToken || !data) return;
            if (data.phase === "init" && Number.isFinite(data.percent)) {
                $("scrambleText").textContent = `初始化 ${Math.round(data.percent)}%`;
            } else if (data.phase === "solve" && data.total) {
                $("scrambleText").textContent = `求解 ${data.current}/${data.total}`;
            }
        });
        if (token !== genToken) return;
        if (local) {
            setScramble(local, false, puzzleKey);
            // 预取已挪到计时期间（见 prefetchNextScramble），这里不再抢带宽
            return;
        }
    }

    if (!hasCubingLib()) {
        // cubing.js 还在加载时先占位，加载完会自动重新生成
        if (!libSettled && !libFailed) {
            $("scrambleText").textContent = "打乱加载中...";
            $("warnMsg").style.display = "none";
            setPuzzle(puzzleKey);
            return;
        }

        const fallbackList = fData[puzzle.eventId];
        if (fallbackList && fallbackList.length) {
            setScramble(randomOf(fallbackList), true, puzzleKey);
        } else {
            showOffline(puzzleKey);
        }
        return;
    }

    if (preloaded && preloadedPuzzle === puzzle.key) {
        const s = preloaded;
        preloaded = null;
        setScramble(s, false, puzzleKey);
        prefetch();
        return;
    }

    $("scrambleText").textContent = "生成中...";
    $("warnMsg").style.display = "none";
    try {
        const a = await randomScrambleForEvent(legacyEventId);
        if (token !== genToken) return; // 已被更新的请求取代
        setScramble(a.toString(), false, puzzleKey);
        prefetch();
    } catch (e) {
        if (token !== genToken) return;
        const fallbackList = fData[puzzle.eventId];
        if (fallbackList && fallbackList.length) {
            setScramble(randomOf(fallbackList), true, puzzleKey);
        } else {
            showOffline(puzzleKey);
        }
    }
}

function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
}
