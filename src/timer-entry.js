import { state } from "./state.js";
import { initNav, initPuzzleDropdown } from "./ui.js";
import { initTimer } from "./timer.js";
import { initRecordsUI, renderHist } from "./records.js";
import {
    genScr,
    loadCubing,
    prefetchNextScramble,
    preloadLocalProvider,
    resetScrambleCache,
} from "./scramble.js";
import { initHardwareUI } from "./hardware/ui.js";
import { renderFlatCube } from "./flatCubeView.js";

window.onerror = function (msg) {
    console.log("防崩捕获:", msg);
    return true;
};

initNav();
initRecordsUI();
const timer = initTimer({
    onStart: prefetchNextScramble,
    onStop: genScr,
});
initHardwareUI(timer);

const cube = document.getElementById("scrambleCube");
renderFlatCube(cube, {
    puzzle: state.puzzle.puzzle || state.puzzle.key,
    alg: "",
    label: "当前打乱状态的六面平面展开图",
});

document.getElementById("observeCheckbox").onchange = (event) => {
    state.observe = event.target.checked;
    document.getElementById("observeBadge").hidden = !state.observe;
};

document.getElementById("newScrambleBtn").onclick = () => genScr();

initPuzzleDropdown(async (puzzle) => {
    state.puzzle = puzzle;
    preloadLocalProvider(puzzle);
    resetScrambleCache();
    await genScr();
    renderHist();
});

renderHist();
genScr();
loadCubing();
