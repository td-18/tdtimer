import { getRandomAUF, state } from "./state.js";
import {
    HIDDEN_PUZZLES,
    getGroupCategories,
    groupCategories,
    normalizeCategories,
} from "./formulaSets.js";
import {
    getPuzzleMeta,
    getTwistyPuzzle,
    normalizeFormulaAlg,
    supportsRandomAUF,
} from "./algNotation.js";
import { renderHist } from "./records.js";
import { loadAllLsllOneStep } from "./lsllLoader.js";
import { renderFlatCube } from "./flatCubeView.js";
import { invertAlg } from "./algInverse.js";

function resetSetSelect() {
    const select = document.getElementById("trainSetSelect");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);

    const all = document.createElement("option");
    all.value = "";
    all.textContent = "整个分组";
    select.appendChild(all);
    select.disabled = true;
}

function fillSetOptions(puzzle, group, selected = "") {
    const select = document.getElementById("trainSetSelect");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);

    const all = document.createElement("option");
    all.value = "";
    all.textContent = "整个分组";
    select.appendChild(all);

    getGroupCategories(puzzle, group).forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.key;
        opt.textContent = cat.key;
        select.appendChild(opt);
    });

    select.disabled = false;
    select.value = selected;
}

function readTrainGroup() {
    const value = document.getElementById("trainGroupSelect").value;
    if (!value) return null;
    const sep = value.indexOf("|");
    return { puzzle: value.slice(0, sep), group: value.slice(sep + 1) };
}

function syncTrainUI() {
    const mode = state.trainMode;
    const groupSel = document.getElementById("trainGroupSelect");
    const setSel = document.getElementById("trainSetSelect");
    const startBtn = document.getElementById("btnStartTrain");
    const stopBtn = document.getElementById("btnStopTrain");
    const bar = document.getElementById("trainBar");

    if (mode) {
        groupSel.value = mode[0] + "|" + mode[1];
        fillSetOptions(mode[0], mode[1], mode[2] || "");
        groupSel.disabled = true;
        setSel.disabled = true;
        startBtn.style.display = "none";
        stopBtn.style.display = "inline-block";

        const puzzleName = getPuzzleMeta(mode[0]).short;
        const scope = mode[2] || "整个分组";
        document.getElementById("trainBarText").textContent = `训练中：${puzzleName} · ${mode[1]} · ${scope}`;
        bar.classList.add("show");
    } else {
        groupSel.value = "";
        groupSel.disabled = false;
        resetSetSelect();
        startBtn.style.display = "inline-block";
        startBtn.disabled = true;
        stopBtn.style.display = "none";
        bar.classList.remove("show");
    }
}

function fillTrainGroups() {
    const select = document.getElementById("trainGroupSelect");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "选择分组";
    select.appendChild(placeholder);

    const db = window.FormulaDB;
    if (!db) return;

    Object.keys(db)
        .filter((puzzleKey) => HIDDEN_PUZZLES.indexOf(puzzleKey) === -1)
        .forEach((puzzleKey) => {
            const cats = normalizeCategories(puzzleKey, db[puzzleKey]);
            const groups = groupCategories(puzzleKey, cats);
            if (!groups.length) return;

            const optgroup = document.createElement("optgroup");
            optgroup.label = getPuzzleMeta(puzzleKey).short;

            groups.forEach((group) => {
                const opt = document.createElement("option");
                opt.value = puzzleKey + "|" + group.name;
                opt.textContent = group.name;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });
}

function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function nextTrainingScramble() {
    const mode = state.trainMode;
    if (!mode) return;
    const [puzzleKey, groupName, catName] = mode;
    let categories = getGroupCategories(puzzleKey, groupName).filter((cat) => cat.cases && cat.cases.length);
    if (catName) categories = categories.filter((cat) => cat.key === catName);

    const scramble = document.getElementById("scrambleText");
    const warn = document.getElementById("warnMsg");
    const cube = document.getElementById("scrambleCube");
    if (!categories.length) {
        state.scramble = "";
        scramble.textContent = "该分组暂无公式";
        warn.style.display = "block";
        warn.textContent = "⚠️ 该分组暂无可用公式";
        return;
    }

    const cat = randomOf(categories);
    let picked = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        picked = randomOf(cat.cases);
        if (cat.cases.length < 2 || cat.key + "|" + picked[0] !== state.trainCase) break;
    }

    const [name, alg] = picked;
    state.trainCase = cat.key + "|" + name;
    const displayAlg = normalizeFormulaAlg(puzzleKey, alg);
    const setup = invertAlg(displayAlg);
    let full = setup;
    if (supportsRandomAUF(puzzleKey)) {
        full = (getRandomAUF() + setup + " " + getRandomAUF()).trim();
    }

    state.scramble = full;
    scramble.textContent = `[${cat.key} · ${name}] 打乱: ${full}`;
    warn.style.display = "block";
    warn.textContent = supportsRandomAUF(puzzleKey)
        ? "提示: 做原公式（注意 AUF）即可复原"
        : "提示: 打乱为公式的逆序，做原公式即可复原";

    if (cube) {
        const puzzle = getTwistyPuzzle(puzzleKey);
        cube.setAttribute("puzzle", puzzle);
        cube.setAttribute("alg", full);
        renderFlatCube(cube, {
            puzzle,
            alg: full,
            label: `${cat.key} ${name} 训练状态`,
        });
    }
}

export async function startTraining(puzzle, group, cat = "") {
    const needsOneStep = puzzle === "3x3" && group === "LSLL" && (!cat || cat === "LSLL 一步");
    if (needsOneStep) {
        const startBtn = document.getElementById("btnStartTrain");
        const oldText = startBtn ? startBtn.textContent : "";
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = "加载一步公式中…";
        }
        try {
            await loadAllLsllOneStep();
        } catch (err) {
            const warn = document.getElementById("warnMsg");
            if (warn) {
                warn.style.display = "block";
                warn.textContent = "⚠️ 一步 LSLL 公式加载失败，请刷新页面重试";
            }
            return false;
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = oldText || "开始训练";
            }
        }
    }

    state.trainMode = [puzzle, group, cat];
    state.trainCase = "";
    syncTrainUI();
    renderHist();
    nextTrainingScramble();
    return true;
}

export function stopTraining() {
    state.trainMode = null;
    state.trainCase = "";
    state.scramble = "";
    syncTrainUI();
    renderHist();

    const cube = document.getElementById("scrambleCube");
    if (cube) {
        cube.setAttribute("puzzle", state.puzzle.puzzle || state.puzzle.key);
        cube.removeAttribute("alg");
        renderFlatCube(cube, {
            puzzle: state.puzzle.puzzle || state.puzzle.key,
            alg: "",
            label: "训练待开始",
        });
    }
    const text = document.getElementById("scrambleText");
    if (text) text.textContent = "请选择训练分组";
    const warn = document.getElementById("warnMsg");
    if (warn) {
        warn.style.display = "none";
        warn.textContent = "";
    }
}

export function initTrainingUI() {
    fillTrainGroups();
    syncTrainUI();

    const groupSel = document.getElementById("trainGroupSelect");
    const setSel = document.getElementById("trainSetSelect");
    const startBtn = document.getElementById("btnStartTrain");

    groupSel.onchange = () => {
        const selected = readTrainGroup();
        if (!selected) {
            resetSetSelect();
            startBtn.disabled = true;
            return;
        }
        fillSetOptions(selected.puzzle, selected.group);
        startBtn.disabled = false;
    };

    startBtn.onclick = async () => {
        const selected = readTrainGroup();
        if (!selected) return;
        await startTraining(selected.puzzle, selected.group, setSel.value || "");
    };

    document.getElementById("btnStopTrain").onclick = () => stopTraining();
    document.getElementById("btnExitTrain").onclick = () => stopTraining();
}
