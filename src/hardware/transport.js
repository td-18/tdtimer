// Web Bluetooth 薄封装
//
// 只处理「拿设备 → 连 GATT → 订阅 / 写」这些浏览器 API 差异，
// 不掺协议逻辑，方便在 Node 里对协议做纯逻辑测试。

export function isBluetoothSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export async function requestDevice(options) {
    if (!isBluetoothSupported()) throw new Error("当前浏览器不支持 Web Bluetooth");
    return navigator.bluetooth.requestDevice(options);
}

export async function connectGatt(device) {
    if (!device || !device.gatt) throw new Error("设备不可用");
    return device.gatt.connect();
}

export async function listPrimaryServices(server) {
    return server.getPrimaryServices();
}

export function findService(services, uuid) {
    const target = String(uuid).toLowerCase();
    return services.find((service) => String(service.uuid).toLowerCase() === target) || null;
}

export async function getCharacteristic(service, uuid) {
    return service.getCharacteristic(uuid);
}

export function dataViewToBytes(dataView) {
    if (!dataView) return new Uint8Array(0);
    return new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
}

export function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

// 系统蓝牙适配器是否可用；浏览器不支持该查询时按可用处理
export async function bluetoothAvailable() {
    try {
        if (navigator.bluetooth && typeof navigator.bluetooth.getAvailability === "function") {
            return await navigator.bluetooth.getAvailability();
        }
        return true;
    } catch (err) {
        return true;
    }
}

// 把 Web Bluetooth 的异常翻译成能直接给用户看的文案
// 只有「用户真的取消了选择框」才算取消：Chrome 在无法弹出选择器时
// 也会抛 NotFoundError "User cancelled..."，用耗时区分（真人取消不可能几十毫秒）
export function describeRequestError(err, elapsedMs = Number.POSITIVE_INFINITY) {
    const name = (err && err.name) || "Error";
    const message = String((err && err.message) || "");
    const detail = `${name}${message ? `：${message}` : ""}`;
    const tooFast = Number.isFinite(elapsedMs) && elapsedMs < 300;

    if (/cancel/i.test(message)) {
        if (!tooFast) return { cancelled: true, message: "已取消选择设备", detail };
        return {
            cancelled: false,
            message: `无法打开蓝牙设备选择器：当前环境不支持或系统蓝牙未开启，请用 Chrome / Edge 打开本页重试（${detail}）`,
            detail,
        };
    }

    let friendly = "蓝牙请求失败";
    if (name === "NotFoundError") {
        friendly = /adapter/i.test(message)
            ? "系统没有可用的蓝牙适配器：请打开系统蓝牙或接上适配器后重试"
            : "没有找到可用设备：请确认设备已开机、处于可连接状态";
    } else if (name === "SecurityError") {
        friendly = "浏览器拒绝了蓝牙请求：需要 HTTPS 页面并由点击触发";
    } else if (name === "NotSupportedError") {
        friendly = "当前浏览器不支持 Web Bluetooth（需要 Chrome / Edge；iOS Safari 不支持）";
    } else if (name === "NotAllowedError") {
        friendly = "蓝牙权限被拒绝，请在浏览器地址栏重新允许";
    } else if (name === "NetworkError") {
        friendly = "蓝牙连接中断：设备可能已断开或距离过远";
    } else if (name === "InvalidStateError") {
        friendly = "上一次蓝牙请求还没结束，请稍候再试";
    } else if (name === "AbortError") {
        friendly = "蓝牙请求被中止，请重试";
    }
    return { cancelled: false, message: `${friendly}（${detail}）`, detail };
}

// ===== 广播包里的 MAC =====
// GAN 把 MAC 放在厂商数据（CIC 低字节 0x01）的末尾 6 字节，倒序存放；
// 浏览器不保证一定给广播数据，所以这里全部按「尽力而为」处理。

export const GAN_CIC_LIST = Array.from({ length: 256 }, (_v, i) => (i << 8) | 0x01);

function macFromManufacturerBytes(view) {
    if (!view) return null;
    let bytes;
    if (view instanceof DataView) {
        bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    } else if (view instanceof Uint8Array) {
        bytes = view;
    } else if (view && view.buffer) {
        bytes = new Uint8Array(view.buffer);
    } else {
        return null;
    }
    // 有的实现（Bluefy）前面多带 2 字节，按 GAN 的 9 字节布局截断
    if (bytes.length >= 11) {
        bytes = bytes.slice(2, 11);
    } else if (bytes.length > 9) {
        bytes = bytes.slice(0, 9);
    }
    if (bytes.length < 6) return null;
    const parts = [];
    for (let i = bytes.length - 1; i >= bytes.length - 6; i--) {
        parts.push(bytes[i].toString(16).toUpperCase().padStart(2, "0"));
    }
    return parts.join(":");
}

export function extractMacFromManufacturerData(manufacturerData) {
    if (!manufacturerData) return null;
    // Bluefy 直接给 DataView，Chrome 给 Map<CIC, DataView>
    if (typeof DataView !== "undefined" && manufacturerData instanceof DataView) {
        return macFromManufacturerBytes(manufacturerData);
    }
    if (typeof manufacturerData.forEach !== "function") return null;
    let mac = null;
    manufacturerData.forEach((value, key) => {
        if (mac || (key & 0xff) !== 0x01) return;
        mac = macFromManufacturerBytes(value);
    });
    return mac;
}

// 监听广播，返回 { mac, stop }
// 必须在 gatt.connect() 之前开始监听：设备连上后通常不再广播。
export function watchForMac(device, timeoutMs = 4000) {
    const noop = { mac: Promise.resolve(null), stop() {} };
    if (!device || typeof device.watchAdvertisements !== "function") return noop;

    let finishResolve;
    let stopped = false;
    let timer = null;
    let controller = null;
    const mac = new Promise((resolve) => {
        finishResolve = resolve;
    });

    const finish = (value) => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        if (controller) {
            try {
                controller.abort();
            } catch (err) {}
        }
        device.removeEventListener("advertisementreceived", onAdvertisement);
        finishResolve(value);
    };

    const onAdvertisement = (event) => {
        const found = extractMacFromManufacturerData(event.manufacturerData);
        if (found) finish(found);
    };

    try {
        controller = typeof AbortController === "function" ? new AbortController() : null;
        device.addEventListener("advertisementreceived", onAdvertisement);
        const watching = controller
            ? device.watchAdvertisements({ signal: controller.signal })
            : device.watchAdvertisements();
        Promise.resolve(watching).catch(() => finish(null));
        timer = setTimeout(() => finish(null), timeoutMs);
    } catch (err) {
        finish(null);
    }

    return { mac, stop: () => finish(null) };
}

// 通知订阅：返回取消函数
export async function subscribe(characteristic, handler) {
    const listener = (event) => {
        const target = event.target;
        if (!target || !target.value) return;
        handler(dataViewToBytes(target.value));
    };
    characteristic.addEventListener("characteristicvaluechanged", listener);
    await characteristic.startNotifications();
    return () => {
        characteristic.removeEventListener("characteristicvaluechanged", listener);
        return characteristic.stopNotifications().catch(() => {});
    };
}

// GATT 写必须串行：命令之间互相覆盖会丢帧
export function createWriter(characteristic) {
    let chain = Promise.resolve();
    return (bytes) => {
        const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const job = chain.then(async () => {
            if (typeof characteristic.writeValueWithResponse === "function") {
                await characteristic.writeValueWithResponse(payload);
            } else {
                await characteristic.writeValue(payload);
            }
        });
        // 单次写失败也要放行后续命令，否则队列会一直挂住
        chain = job.catch(() => {});
        return job;
    };
}

export function disconnectDevice(device) {
    if (device && device.gatt && device.gatt.connected) device.gatt.disconnect();
}
