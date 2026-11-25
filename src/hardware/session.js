// 蓝牙会话：连接、按服务识别设备、把通知转成事件
//
// 上层（弹窗、计时器联动）只订阅事件，不直接碰 GATT。
// 事件：
//   status  { phase, message, profile, deviceName, mac }
//   timer   { state, stateName, recordedTime, previousTimes }
//   cube    { type, ... }（hardware / battery / facelets / move / gyro）
//   log     { direction, text }
//
// phase: idle / connecting / connected / warning / disconnected / error

import {
    bytesToHex,
    bluetoothAvailable,
    dataViewToBytes,
    connectGatt,
    createWriter,
    describeRequestError,
    disconnectDevice,
    findService,
    getCharacteristic,
    listPrimaryServices,
    requestDevice,
    subscribe,
    watchForMac,
} from "./transport.js";
import { detectProfile, requestOptions } from "./registry.js";
import {
    GAN_GEN2_COMMAND_CHARACTERISTIC,
    GAN_GEN2_SERVICE,
    GAN_GEN2_STATE_CHARACTERISTIC,
    GAN_GEN3_COMMAND_CHARACTERISTIC,
    GAN_GEN3_SERVICE,
    GAN_GEN3_STATE_CHARACTERISTIC,
    GAN_GEN4_COMMAND_CHARACTERISTIC,
    GAN_GEN4_SERVICE,
    GAN_GEN4_STATE_CHARACTERISTIC,
    createDriver,
    createEncrypter,
} from "./protocols/gan.js";
import {
    GAN_TIMER_SERVICE,
    GAN_TIMER_STATE_CHARACTERISTIC,
    GAN_TIMER_TIME_CHARACTERISTIC,
    parseRecordedTimes,
    parseTimerFrame,
} from "./protocols/gan-timer.js";
import { clearMac, getDeviceMac, normalizeMac, resolveMac, saveMac } from "./mac.js";

const CUBE_ENDPOINTS = {
    2: {
        service: GAN_GEN2_SERVICE,
        command: GAN_GEN2_COMMAND_CHARACTERISTIC,
        state: GAN_GEN2_STATE_CHARACTERISTIC,
    },
    3: {
        service: GAN_GEN3_SERVICE,
        command: GAN_GEN3_COMMAND_CHARACTERISTIC,
        state: GAN_GEN3_STATE_CHARACTERISTIC,
    },
    4: {
        service: GAN_GEN4_SERVICE,
        command: GAN_GEN4_COMMAND_CHARACTERISTIC,
        state: GAN_GEN4_STATE_CHARACTERISTIC,
    },
};

const GARBAGE_FRAME_LIMIT = 40;

export class HardwareSession extends EventTarget {
    constructor() {
        super();
        this.device = null;
        this.profile = null;
        this.mac = "";
        this.macSource = "";
        this.services = [];
        this.driver = null;
        this.encrypter = null;
        this.timer = { state: null, stateName: "", recordedTime: null, previousTimes: [] };
        this.cube = {
            hardwareName: "",
            softwareVersion: "",
            hardwareVersion: "",
            productDate: "",
            battery: null,
            facelets: "",
            solved: null,
            moves: 0,
            lastMove: "",
        };
        this._unsubscribe = null;
        this._onGattDisconnected = null;
        this._frames = 0;
        this._decodedFrames = 0;
        this._garbageWarned = false;
        this._macSaved = false;
    }

    get connected() {
        return !!(this.device && this.device.gatt && this.device.gatt.connected);
    }

    async connect(macInput = "") {
        if (this.device) await this.disconnect();

        if (!(await bluetoothAvailable())) {
            const err = new Error("bluetooth-unavailable");
            err.displayMessage = "系统没有可用的蓝牙适配器：请打开系统蓝牙或接上适配器后重试";
            this._emit("log", { direction: "!", text: "getAvailability() = false" });
            this._emit("status", { phase: "error", message: err.displayMessage });
            throw err;
        }

        this._emit("status", { phase: "connecting", message: "请选择设备…" });
        let device;
        const requestStart = typeof performance !== "undefined" ? performance.now() : Date.now();
        try {
            device = await requestDevice(requestOptions());
        } catch (err) {
            const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - requestStart;
            const info = describeRequestError(err, elapsed);
            this._emit("log", { direction: "!", text: info.detail });
            this._emit("status", {
                phase: info.cancelled ? "idle" : "error",
                message: info.message,
            });
            err.cancelled = info.cancelled;
            err.displayMessage = info.message;
            throw err;
        }

        this.device = device;
        const deviceName = device.name || "未命名设备";
        const typedMac = normalizeMac(macInput);
        const cachedMac = getDeviceMac(device.name || "");
        // 设备连上后通常不再广播，必须在 gatt.connect() 之前开始监听；
        // 已有输入或缓存时只等很短的时间，避免每次连接都卡住
        const macWatch = typedMac ? { mac: Promise.resolve(null), stop() {} } : watchForMac(device, cachedMac ? 1500 : 4000);
        this._emit("status", { phase: "connecting", message: `正在连接 ${deviceName}…` });

        let server;
        try {
            server = await connectGatt(device);
        } catch (err) {
            macWatch.stop();
            this.device = null;
            const detail = `${err.name || "Error"}${err.message ? `：${err.message}` : ""}`;
            err.displayMessage = `连接失败：设备可能已断电、距离过远或被其它应用占用（${detail}）`;
            this._emit("log", { direction: "!", text: detail });
            this._emit("status", { phase: "error", message: err.displayMessage });
            throw err;
        }

        this._onGattDisconnected = () => {
            this._emit("status", { phase: "disconnected", message: "设备已断开" });
            this._cleanup();
        };
        device.addEventListener("gattserverdisconnected", this._onGattDisconnected);

        let services;
        try {
            services = await listPrimaryServices(server);
        } catch (err) {
            macWatch.stop();
            await this.disconnect();
            throw err;
        }
        this.services = services;

        const profile = detectProfile(services.map((service) => service.uuid));
        if (!profile) {
            macWatch.stop();
            const list = services.map((service) => service.uuid).join(", ");
            const err = new Error("unsupported-device");
            err.code = "UNSUPPORTED";
            err.displayMessage = `未识别的设备类型。服务：${list || "无"}`;
            await this.disconnect();
            this._emit("status", { phase: "error", message: err.displayMessage });
            throw err;
        }
        this.profile = profile;

        try {
            if (profile.kind === "gan-timer") {
                macWatch.stop();
                await this._attachTimer(services);
            } else {
                const advertised = await macWatch.mac;
                await this._attachCube(services, profile.gen, {
                    typed: macInput,
                    advertised,
                    cached: cachedMac,
                    deviceName: device.name || "",
                });
            }
        } catch (err) {
            macWatch.stop();
            await this.disconnect();
            if (!err.displayMessage) {
                const detail = `${err.name || "Error"}${err.message ? `：${err.message}` : ""}`;
                err.displayMessage = `设备初始化失败（${detail}）`;
                this._emit("log", { direction: "!", text: detail });
            }
            this._emit("status", { phase: "error", message: err.displayMessage });
            throw err;
        }

        this._emit("status", {
            phase: "connected",
            message: `${profile.label} 已连接`,
            profile,
            deviceName,
            mac: this.mac,
            macSource: this.macSource,
        });
        return { profile, deviceName, mac: this.mac, macSource: this.macSource };
    }

    async _attachTimer(services) {
        const service = findService(services, GAN_TIMER_SERVICE);
        if (!service) throw new Error("找不到 GAN 计时器服务");
        const stateChar = await getCharacteristic(service, GAN_TIMER_STATE_CHARACTERISTIC);
        this._unsubscribe = await subscribe(stateChar, (bytes) => this._onTimerBytes(bytes));

        try {
            const timeChar = await getCharacteristic(service, GAN_TIMER_TIME_CHARACTERISTIC);
            const view = await timeChar.readValue();
            const times = parseRecordedTimes(dataViewToBytes(view));
            if (times) {
                this.timer.previousTimes = times.previousTimes;
                this.timer.recordedTime = times.displayTime;
                this._emit("timer", { ...this.timer, type: "recorded" });
            }
        } catch (err) {
            // 部分固件不支持读取历史成绩，不影响实时通知
            this._emit("log", { direction: "!", text: "读取历史成绩失败（可忽略）" });
        }
    }

    async _attachCube(services, gen, ctx) {
        const endpoints = CUBE_ENDPOINTS[gen];
        const service = findService(services, endpoints.service);
        if (!service) throw new Error(`找不到 GAN Gen${gen} 服务`);

        const resolved = resolveMac({
            typed: ctx.typed,
            advertised: ctx.advertised,
            deviceName: ctx.deviceName,
            cached: ctx.cached,
        });
        if (!resolved.mac) {
            const err = new Error("missing-mac");
            err.code = "MAC_REQUIRED";
            err.displayMessage = "GAN 魔方需要 MAC：浏览器没提供广播地址，请手输 12 位十六进制（见魔方卡片或官方 App）";
            this._emit("status", { phase: "error", message: err.displayMessage });
            throw err;
        }
        this.mac = resolved.mac;
        this.macSource = resolved.source;
        // 等第一帧成功解出再写缓存，避免把错误 MAC 存下来
        this._macSaved = false;

        this.encrypter = createEncrypter(resolved.mac);
        this.driver = createDriver(gen);

        const commandChar = await getCharacteristic(service, endpoints.command);
        const stateChar = await getCharacteristic(service, endpoints.state);
        this._writer = createWriter(commandChar);

        this._unsubscribe = await subscribe(stateChar, (bytes) => this._onCubeBytes(bytes));

        // 先要硬件信息，再要面片和电量；面片回来之前的转动会被固件忽略
        this._sendCubeCommand(this.driver.command("hardware"));
        this._sendCubeCommand(this.driver.command("facelets"));
        this._sendCubeCommand(this.driver.command("battery"));
    }

    _onTimerBytes(bytes) {
        const frame = parseTimerFrame(bytes);
        if (!frame) {
            this._emit("log", { direction: "?", text: `无法校验的计时器帧：${bytesToHex(bytes)}` });
            return;
        }
        this.timer.state = frame.state;
        this.timer.stateName = frame.stateName;
        if (frame.recordedTime) {
            this.timer.recordedTime = frame.recordedTime;
            this.timer.previousTimes = [frame.recordedTime, ...this.timer.previousTimes].slice(0, 3);
        }
        this._emit("log", { direction: "←", text: `计时器 ${frame.stateName} ${bytesToHex(bytes)}` });
        this._emit("timer", { ...this.timer, type: "state" });
    }

    _onCubeBytes(bytes) {
        this._frames++;
        this._emit("log", { direction: "←", text: bytesToHex(bytes) });
        if (!this.encrypter || !this.driver) return;

        let decrypted;
        try {
            decrypted = this.encrypter.decrypt(bytes);
        } catch (err) {
            return;
        }

        const io = {
            send: (message) => this._sendCubeCommand(message),
            disconnect: () => this.disconnect(),
            now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
        };

        let events;
        try {
            events = this.driver.handle(decrypted, io) || [];
        } catch (err) {
            events = [];
        }
        if (events.length > 0) {
            this._decodedFrames++;
            // 第一帧成功解码才落缓存：错误的 MAC 解不出事件，不会污染下次连接
            if (!this._macSaved) {
                this._macSaved = true;
                saveMac(this.device && this.device.name, this.mac);
            }
        }

        events.forEach((event) => this._applyCubeEvent(event));

        // 解不出任何事件时，大概率是 MAC 错了：密钥不对只会静默产出垃圾
        if (!this._garbageWarned && this._frames >= GARBAGE_FRAME_LIMIT && this._decodedFrames === 0) {
            this._garbageWarned = true;
            // 缓存 / 设备名来的地址可能过期或本来就不对，直接清掉让用户重输
            const fromGuess = this.macSource === "cache" || this.macSource === "name";
            if (fromGuess) clearMac(this.device && this.device.name);
            this._emit("status", {
                phase: "warning",
                message: fromGuess
                    ? "收到数据但解析不出事件：已清除这台设备的 MAC 缓存，请重新输入 MAC 后连接"
                    : "收到数据但解析不出事件，MAC 可能不正确，请核对后重新连接",
                profile: this.profile,
                deviceName: this.device && this.device.name,
                mac: this.mac,
                macSource: this.macSource,
            });
        }
    }

    _applyCubeEvent(event) {
        if (event.type === "hardware") {
            this.cube.hardwareName = event.hardwareName || this.cube.hardwareName;
            this.cube.softwareVersion = event.softwareVersion || "";
            this.cube.hardwareVersion = event.hardwareVersion || "";
            this.cube.productDate = event.productDate || "";
        } else if (event.type === "battery") {
            this.cube.battery = event.batteryLevel;
        } else if (event.type === "facelets") {
            this.cube.facelets = event.facelets;
            this.cube.solved = event.solved;
        } else if (event.type === "move") {
            this.cube.moves++;
            this.cube.lastMove = event.move;
        }
        this._emit("cube", event);
    }

    _sendCubeCommand(message) {
        if (!message || !this._writer || !this.encrypter) return Promise.resolve();
        let payload;
        try {
            payload = this.encrypter.encrypt(message);
        } catch (err) {
            return Promise.resolve();
        }
        return this._writer(payload).catch(() => {});
    }

    async disconnect() {
        this._cleanup();
        if (this.device) {
            try {
                disconnectDevice(this.device);
            } catch (err) {}
        }
        this.device = null;
        this.profile = null;
        this.mac = "";
        this.macSource = "";
        this.driver = null;
        this.encrypter = null;
        this.services = [];
        this.timer = { state: null, stateName: "", recordedTime: null, previousTimes: [] };
        this._emit("status", { phase: "idle", message: "未连接" });
    }

    _cleanup() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        if (this.device && this._onGattDisconnected) {
            this.device.removeEventListener("gattserverdisconnected", this._onGattDisconnected);
            this._onGattDisconnected = null;
        }
        this._writer = null;
        this._frames = 0;
        this._decodedFrames = 0;
        this._garbageWarned = false;
    }

    _emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }
}
