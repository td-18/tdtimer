import { initTimer } from "./timer.js";
import { initRecordsUI } from "./records.js";
import { initTrainingUI, nextTrainingScramble, stopTraining } from "./training.js";
import { decorateTwistyElement, loadTwisty } from "./twistyView.js";
import { state } from "./state.js";

initRecordsUI();
initTrainingUI();
initTimer({ onStop: nextTrainingScramble });

const cube = document.getElementById("scrambleCube");
decorateTwistyElement(cube, {
    puzzle: state.puzzle.puzzle || state.puzzle.key,
    alg: "",
    label: "训练待开始",
});
loadTwisty();
stopTraining();

document.getElementById("newScrambleBtn").onclick = () => {
    if (state.trainMode) nextTrainingScramble();
};
