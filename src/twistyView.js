import { settleWithin } from "./loadGuard.js";
import { applyAlgToFaceletsForPuzzle, cubeThumbSVG } from "./cubeThumb.js";

const TWISTY_URL = "https://cdn.cubing.net/v0/js/cubing/twisty";
const ICON_CSS_URL = "https://cdn.cubing.net/v0/css/@cubing/icons/css";
const LOAD_TIMEOUT_MS = 5000;

const CUBE_KEY_BY_TWISTY = {
    "2x2x2": "2x2",
    "3x3x3": "3x3",
    "4x4x4": "4x4",
    "5x5x5": "5x5",
    "6x6x6": "6x6",
    "7x7x7": "7x7",
};

let status = "idle";
let loading = null;

function dispatchStatus(error) {
    if (typeof document === "undefined") return;
    document.dispatchEvent(new CustomEvent("td:twisty-status", {
        detail: { status, error: error || null },
    }));
}

function setStatus(next, error) {
    status = next;
    if (typeof document === "undefined") return;
    document.querySelectorAll("twisty-player[data-td-fallback]").forEach((el) => {
        if (next === "ready") {
            el.replaceChildren();
            el.removeAttribute("data-td-fallback");
            el.removeAttribute("data-td-fallback-state");
            if (typeof el._tdOnReady === "function") {
                const callback = el._tdOnReady;
                delete el._tdOnReady;
                callback();
            }
        } else if (next === "failed") {
            el.setAttribute("data-td-fallback-state", "failed");
            const note = el.querySelector(".twistyFallbackNote");
            if (note) note.textContent = "3D 加载失败，已显示平面图";
        }
    });
    dispatchStatus(error);
}

export function loadTwisty(options = {}) {
    if (status === "ready") return Promise.resolve(true);
    if (loading) return loading;

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : LOAD_TIMEOUT_MS;
    status = "loading";

    if (typeof document !== "undefined" && !document.querySelector('link[data-td-icons-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = ICON_CSS_URL;
        link.dataset.tdIconsCss = "";
        document.head.appendChild(link);
    }

    const request = import(TWISTY_URL);
    request.then(
        () => setStatus("ready"),
        (error) => setStatus("failed", error)
    );
    loading = settleWithin(request, timeoutMs, "cubing.js 3D").then(
        () => true,
        (error) => {
            if (status === "loading") setStatus("failed", error);
            return false;
        }
    );
    return loading;
}

export function getTwistyStatus() {
    return status;
}

function genericCubeNetSVG(size = 108) {
    const colors = {
        U: "#ffffff",
        L: "#ff9f43",
        F: "#35b86b",
        R: "#e5484d",
        B: "#3978d4",
        D: "#ffd43b",
    };
    const faces = [
        ["U", 3, 0], ["L", 0, 3], ["F", 3, 3], ["R", 6, 3], ["B", 9, 3], ["D", 3, 6],
    ];
    const cell = 18;
    const parts = [];
    faces.forEach(([face, fx, fy]) => {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                parts.push(
                    `<rect x="${fx * cell + col * 6}" y="${fy * cell + row * 6}" width="6" height="6" `
                    + `fill="${colors[face]}" stroke="#15243a" stroke-width="0.65"/>`
                );
            }
        }
    });
    return `<svg class="flatCubeNet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 216 162" `
        + `width="${size}" height="${Math.round(size * 0.75)}" role="img" aria-label="魔方六面平面展开图">`
        + `<rect width="216" height="162" rx="8" fill="#f7fbff"/>${parts.join("")}</svg>`;
}

export function fallbackSVGFor(puzzle, alg, size = 108) {
    const cubeKey = CUBE_KEY_BY_TWISTY[puzzle];
    if (cubeKey) {
        try {
            const facelets = applyAlgToFaceletsForPuzzle(cubeKey, alg || "");
            return cubeThumbSVG(facelets, size, { forceFlat: true });
        } catch {
            // 非标准记法或暂不支持的解析路径统一落到六面展开图。
        }
    }
    return genericCubeNetSVG(size);
}

export function decorateTwistyElement(el, options = {}) {
    if (!el || status === "ready") return;
    const stateText = status === "failed" ? "failed" : status === "loading" ? "loading" : "idle";
    const noteText = stateText === "failed"
        ? "3D 加载失败，已显示平面图"
        : "3D 加载中，暂以平面图显示";
    el.setAttribute("data-td-fallback", "");
    el.setAttribute("data-td-fallback-state", stateText);
    if (typeof options.onReady === "function") el._tdOnReady = options.onReady;
    el.innerHTML = `<span class="twistyFallbackInner">${fallbackSVGFor(options.puzzle, options.alg)}`
        + `<span class="twistyFallbackNote">${noteText}</span></span>`;
    el.setAttribute("aria-label", options.label || "魔方状态平面图");
}
