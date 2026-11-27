// 计时状态机：idle → readyCount(0.8s) → ready → running；支持 15s 观察
import { state } from "./state.js";
import { addRecord } from "./records.js";

const HOLD_MS = 800;
const OBSERVE_MS = 15000;
const OBSERVE_DNF_MS = 17000;

export function initTimer(options = {}) {
    const onStart = typeof options.onStart === "function" ? options.onStart : null;
    const onStop = typeof options.onStop === "function" ? options.onStop : null;
    const tDom = document.getElementById("timeDisplay");
    let tState = "idle";
    let startAt = 0;
    let raf = null;
    let readyTimer = null;
    let obsTimer = null;
    let obsAt = 0;
    let over = false;
    let pressAt = 0;
    let wasIdle = false;
    let pressing = false;

    function clearTimers() {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; }
        if (obsTimer) { clearInterval(obsTimer); obsTimer = null; }
    }

    function reset() {
        clearTimers();
        tState = "idle";
        over = false;
        tDom.className = "";
        tDom.textContent = "0.00";
    }

    function startTimer() {
        clearTimers();
        startAt = performance.now();
        tState = "running";
        if (onStart) onStart();
        tDom.className = "";
        const loop = () => {
            if (tState !== "running") return;
            tDom.textContent = ((performance.now() - startAt) / 1000).toFixed(2);
            raf = requestAnimationFrame(loop);
        };
        loop();
    }

    function stopTimer() {
        if (tState !== "running") {
            reset();
            return;
        }
        addRecord(performance.now() - startAt, state.scramble, over ? "+2" : "");
        tState = "idle";
        over = false;
        clearTimers();
        tDom.className = "";
        if (onStop) onStop();
    }

    function startObserve() {
        clearTimers();
        tState = "observe";
        obsAt = performance.now();
        over = false;
        tDom.className = "observe";
        tDom.textContent = "15";
        obsTimer = setInterval(() => {
            const elapsed = performance.now() - obsAt;
            if (elapsed >= OBSERVE_DNF_MS) {
                addRecord(0, state.scramble, "DNF");
                reset();
                tDom.className = "observe";
                tDom.textContent = "DNF";
                if (onStop) onStop();
                return;
            }
            if (elapsed >= OBSERVE_MS) {
                over = true;
                tDom.textContent = "+2";
            } else {
                tDom.textContent = Math.ceil((OBSERVE_MS - elapsed) / 1000).toString();
            }
        }, 100);
    }

    function press() {
        clearTimers();
        if (tState === "running") {
            stopTimer();
            return;
        }
        if (tState === "idle" || tState === "observe") {
            pressAt = performance.now();
            tState = "readyCount";
            tDom.className = "ready";
            if (wasIdle) tDom.textContent = "0.00";
            readyTimer = setTimeout(() => {
                if (tState === "readyCount") {
                    tState = "ready";
                    tDom.className = "go";
                }
            }, HOLD_MS);
        }
    }

    function release() {
        const held = performance.now() - pressAt;
        clearTimeout(readyTimer);
        readyTimer = null;

        if (tState === "ready") {
            startTimer();
        } else if (tState === "readyCount") {
            if (held < HOLD_MS && wasIdle && state.observe) {
                reset();
                startObserve();
            } else {
                tState = "idle";
                tDom.className = "";
            }
        }
    }

    // 外部设备（蓝牙计时器）控制：只影响状态机，不改键盘 / 触控路径
    function externalArm() {
        if (tState === "running") return;
        clearTimers();
        tState = "ready";
        over = false;
        tDom.className = "go";
        tDom.textContent = "0.00";
    }

    function externalStart() {
        if (tState === "running") return;
        startTimer();
    }

    function externalStop() {
        if (tState !== "running") return;
        stopTimer();
    }

    function externalCancelReady() {
        if (tState !== "ready" && tState !== "readyCount") return;
        clearTimers();
        tState = "idle";
        tDom.className = "";
    }

    function externalReset() {
        if (tState === "running") return;
        reset();
    }

    // 左侧面板、3D 魔方、弹窗、按钮都不触发计时
    function isInteractive(target) {
        if (!target || typeof target.closest !== "function") return false;
        return target.closest("header") ||
            target.closest("button") ||
            target.closest("input") ||
            target.closest("label") ||
            target.closest(".trainerPanel") ||
            target.closest("#puzzleDropdownList") ||
            target.closest(".puzzleOption") ||
            target.closest("#detailModal") ||
            target.closest("#settingsModal") ||
            target.closest(".left-col") ||
            target.closest("#formula") ||
            target.closest("#bluetoothModal") ||
            target.closest("#trainBar") ||
            target.closest("#scrambleViewer") ||
            target.closest("twisty-player");
    }

    function isFormControl(target) {
        return !!(target && typeof target.closest === "function" &&
            target.closest('input,textarea,select,[contenteditable="true"]'));
    }

    function down(target) {
        if (isInteractive(target)) return;
        pressing = true;
        wasIdle = tState === "idle";
        press();
    }

    function up() {
        if (!pressing) return;
        pressing = false;
        if (tState !== "running") release();
    }

    document.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        down(e.target);
    });
    document.addEventListener("mouseup", (e) => {
        if (e.button !== 0) return;
        up();
    });
    document.addEventListener("touchstart", (e) => down(e.target), { passive: true });
    document.addEventListener("touchend", up);
    document.addEventListener("contextmenu", (e) => {
        if (isInteractive(e.target)) return;
        e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space") return;
        if (isFormControl(e.target)) return;
        e.preventDefault();
        if (e.repeat) return;
        pressing = true;
        wasIdle = tState === "idle";
        press();
    });
    document.addEventListener("keyup", (e) => {
        if (e.code !== "Space") return;
        if (isFormControl(e.target)) return;
        e.preventDefault();
        if (pressing) {
            pressing = false;
            if (tState !== "running") release();
        }
    });

    return {
        isRunning: () => tState === "running",
        external: {
            arm: externalArm,
            start: externalStart,
            stop: externalStop,
            cancelReady: externalCancelReady,
            reset: externalReset,
        },
    };
}
