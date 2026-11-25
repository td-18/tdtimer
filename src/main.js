// 入口：装配各模块
import { state } from "./state.js";
import { initNav, initPuzzleDropdown } from "./ui.js";
import { initTimer } from "./timer.js";
import { initRecordsUI, renderHist } from "./records.js";
import { initFormulaUI, stopTraining } from "./formula.js";
import { genScr, loadCubing, resetScrambleCache } from "./scramble.js";
import { initHardwareUI } from "./hardware/ui.js";

window.onerror = function (msg) {
    console.log("防崩捕获:", msg);
    return true;
};

initNav();
initRecordsUI();
initFormulaUI();
const timer = initTimer();
initHardwareUI(timer);

document.getElementById("observeCheckbox").onchange = (e) => {
    state.observe = e.target.checked;
    // 计时页只展示开启状态，标识本身不参与任何交互
    document.getElementById("observeBadge").hidden = !state.observe;
};

document.getElementById("newScrambleBtn").onclick = () => genScr();

initPuzzleDropdown(async (puzzle) => {
    state.puzzle = puzzle;
    if (state.trainMode) {
        stopTraining();
    } else {
        resetScrambleCache();
        await genScr();
    }
    renderHist();
});

renderHist();
genScr();
loadCubing();
