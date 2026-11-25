// 蓝牙弹窗交互
//
// 只做三件事：连接 / 断开、展示设备状态、把 GAN 计时器状态接到计时器钩子。
// 其余协议细节都在 session / protocols 里，这里不解析字节。

import { HardwareSession } from "./session.js";
import { isBluetoothSupported } from "./transport.js";
import { clearMacCache, getCachedMac, normalizeMac, saveMac } from "./mac.js";
import { GAN_TIMER_STATE } from "./protocols/gan-timer.js";

const LOG_LIMIT = 40;

const MAC_SOURCE_LABEL = {
    manual: "手输",
    advertisement: "广播包（自动）",
    name: "设备名（自动）",
    cache: "本地缓存",
};

export function initHardwareUI(timer) {
    const modal = document.getElementById("bluetoothModal");
    if (!modal) return null;

    const session = new HardwareSession();
    const supported = isBluetoothSupported();
    const $ = (id) => document.getElementById(id);

    const connectBtn = $("btConnectBtn");
    const disconnectBtn = $("btDisconnectBtn");
    const statusEl = $("btStatus");
    const macInput = $("btMacInput");
    const infoEl = $("btInfo");
    const timerBox = $("btTimerBox");
    const timerStateEl = $("btTimerState");
    const timerTimeEl = $("btTimerTime");
    const logEl = $("btLog");
    const logLines = [];

    if (!supported) {
        $("btSupportHint").hidden = false;
        connectBtn.disabled = true;
    }

    function setStatus(message, kind = "idle") {
        statusEl.textContent = message;
        statusEl.dataset.kind = kind;
    }

    function appendLog(text) {
        const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
        logLines.push(`[${stamp}] ${text}`);
        while (logLines.length > LOG_LIMIT) logLines.shift();
        logEl.textContent = logLines.join("\n");
        logEl.scrollTop = logEl.scrollHeight;
    }

    function addInfoRow(label, value) {
        if (value === "" || value === null || value === undefined) return;
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = String(value);
        infoEl.appendChild(dt);
        infoEl.appendChild(dd);
    }

    function renderInfo() {
        infoEl.textContent = "";
        if (!session.profile) {
            infoEl.hidden = true;
            return;
        }
        infoEl.hidden = false;
        addInfoRow("设备", session.device && session.device.name);
        addInfoRow("类型", session.profile.label);
        addInfoRow("MAC", session.mac);
        addInfoRow("MAC 来源", MAC_SOURCE_LABEL[session.macSource]);
        if (session.profile.kind === "gan-cube") {
            addInfoRow("型号", session.cube.hardwareName);
            addInfoRow("固件", session.cube.softwareVersion);
            addInfoRow("硬件", session.cube.hardwareVersion);
            addInfoRow("生产日期", session.cube.productDate);
            addInfoRow("电量", session.cube.battery === null ? "" : `${session.cube.battery}%`);
            addInfoRow("转动数", session.cube.moves);
            addInfoRow("最近一步", session.cube.lastMove);
            if (session.cube.solved !== null) {
                addInfoRow("当前状态", session.cube.solved ? "已复原" : "打乱中");
            }
        }
    }

    function applyTimerState(detail) {
        timerStateEl.textContent = detail.stateName || "—";
        if (detail.recordedTime) timerTimeEl.textContent = detail.recordedTime.text;
        if (!timer || !timer.external || detail.type !== "state") return;

        // 连上即接管：手放上 → 就绪，手离开 → 开始，停止帧 → 停表
        switch (detail.state) {
            case GAN_TIMER_STATE.HANDS_ON:
                timer.external.arm();
                break;
            case GAN_TIMER_STATE.HANDS_OFF:
                timer.external.cancelReady();
                break;
            case GAN_TIMER_STATE.RUNNING:
                timer.external.start();
                break;
            case GAN_TIMER_STATE.STOPPED:
                timer.external.stop();
                break;
            case GAN_TIMER_STATE.GAN_RESET:
                // 设备复位是硬件动作，不能当成 IDLE 去清计时界面
                timer.external.cancelReady();
                break;
            case GAN_TIMER_STATE.DISCONNECT:
                timer.external.cancelReady();
                break;
            case GAN_TIMER_STATE.IDLE:
                timer.external.reset();
                break;
            default:
                break;
        }
    }

    session.addEventListener("status", (event) => {
        const detail = event.detail;
        const kinds = {
            idle: "idle",
            connecting: "pending",
            connected: "ok",
            warning: "warn",
            disconnected: "idle",
            error: "error",
        };
        setStatus(detail.message, kinds[detail.phase] || "idle");
        const connected = detail.phase === "connected";
        connectBtn.hidden = connected;
        disconnectBtn.hidden = !connected;
        timerBox.hidden = !connected || !session.profile || session.profile.kind !== "gan-timer";
        if (detail.mac) macInput.value = detail.mac;
        renderInfo();
        if (detail.phase === "disconnected" && timer && timer.external) {
            timer.external.cancelReady();
        }
    });

    session.addEventListener("timer", (event) => {
        applyTimerState(event.detail);
    });

    session.addEventListener("cube", () => {
        renderInfo();
    });

    session.addEventListener("log", (event) => {
        appendLog(`${event.detail.direction} ${event.detail.text}`);
    });

    connectBtn.addEventListener("click", async () => {
        const raw = macInput.value.trim();
        if (raw && !normalizeMac(raw)) {
            setStatus("MAC 格式不对：需要 12 位十六进制，例如 AA:BB:CC:DD:EE:FF", "error");
            return;
        }
        connectBtn.disabled = true;
        try {
            await session.connect(raw);
        } catch (err) {
            // 会话层已经给出用户可读文案；只有用户真的取消时才不算错误
            if (!err || !err.cancelled) {
                setStatus((err && err.displayMessage) || "连接失败", "error");
            }
        } finally {
            connectBtn.disabled = !supported;
            connectBtn.hidden = session.connected;
            disconnectBtn.hidden = !session.connected;
        }
    });

    disconnectBtn.addEventListener("click", async () => {
        await session.disconnect();
    });

    $("btMacSaveBtn").addEventListener("click", () => {
        const mac = normalizeMac(macInput.value);
        if (!mac) {
            setStatus("MAC 格式不对：需要 12 位十六进制", "error");
            return;
        }
        macInput.value = mac;
        saveMac(session.device && session.device.name, mac);
        setStatus("MAC 已保存，下次连接同一设备会自动带出", "ok");
    });

    $("btMacClearBtn").addEventListener("click", () => {
        clearMacCache();
        macInput.value = "";
        setStatus("已清除 MAC 缓存", "idle");
    });

    // 打开弹窗时带出上次手输的地址
    document.getElementById("navBluetooth").addEventListener("click", () => {
        if (!macInput.value) macInput.value = getCachedMac("");
    });

    renderInfo();
    return session;
}
