import { applyAlgToFaceletsForPuzzle, cubeNetSVG } from "./cubeThumb.js";

const CUBE_KEY_BY_PUZZLE = {
    "2x2": "2x2",
    "2x2x2": "2x2",
    "3x3": "3x3",
    "3x3x3": "3x3",
    "4x4": "4x4",
    "4x4x4": "4x4",
    "5x5": "5x5",
    "5x5x5": "5x5",
    "6x6": "6x6",
    "6x6x6": "6x6",
    "7x7": "7x7",
    "7x7x7": "7x7",
};

export function flatCubeSVG(puzzle, alg, size = 220, options = {}) {
    const cubeKey = CUBE_KEY_BY_PUZZLE[puzzle];
    if (cubeKey) {
        try {
            const facelets = applyAlgToFaceletsForPuzzle(cubeKey, alg || "");
            return cubeNetSVG(facelets, size, {
                label: options.label || "当前打乱状态的六面平面展开图",
            });
        } catch {
            // 原始记法暂时无法解析时，仍保留可识别的平面占位，不影响计时。
        }
    }
    return `<div class="flatStateUnavailable" role="img" aria-label="当前项目暂无本地平面状态模拟">`
        + `<span>${options.puzzleLabel || puzzle || "当前项目"}</span>`
        + `<small>暂无本地平面状态模拟</small></div>`;
}

export function renderFlatCube(element, options = {}) {
    if (!element) return;
    element.dataset.flatState = "ready";
    element.innerHTML = flatCubeSVG(
        options.puzzle,
        options.alg,
        options.size || 220,
        options
    );
}
