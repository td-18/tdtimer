import { initTimer } from "./timer.js";
import { initRecordsUI } from "./records.js";
import { initTrainingUI, nextTrainingScramble, stopTraining } from "./training.js";
import { renderFlatCube } from "./flatCubeView.js";
import { state } from "./state.js";

initRecordsUI();
initTrainingUI();
initTimer({ onStop: nextTrainingScramble });

const cube = document.getElementById("scrambleCube");
renderFlatCube(cube, {
    puzzle: state.puzzle.puzzle || state.puzzle.key,
    alg: "",
    label: "训练待开始",
});
stopTraining();

document.getElementById("newScrambleBtn").onclick = () => {
    if (state.trainMode) nextTrainingScramble();
};
