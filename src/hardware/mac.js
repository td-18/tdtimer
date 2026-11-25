// 设备 MAC 处理
//
// Web Bluetooth 不暴露适配器 MAC，而 GAN Gen2-4 的密钥需要 MAC 参与派生。
// M1 只做手输（照魔方卡片 / 官方 App 里的地址），并缓存到 localStorage，
// 下次连接同一设备名时自动带出；广播包反推留到 M2。

const MAC_CACHE_KEY = "td_hw_mac_v1";

// 统一成 "AA:BB:CC:DD:EE:FF"；无法识别时返回 null
export function normalizeMac(input) {
    if (typeof input !== "string") return null;
    const hex = input.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    if (hex.length !== 12) return null;
    return hex.match(/.{2}/g).join(":");
}

// GAN 用倒序 MAC 作为盐，返回 6 字节
export function macToSalt(mac) {
    const normalized = normalizeMac(mac);
    if (!normalized) return null;
    return new Uint8Array(normalized.split(":").map((part) => parseInt(part, 16)).reverse());
}

function emptyCache() {
    return { last: "", byName: {} };
}

function readCache() {
    try {
        const raw = localStorage.getItem(MAC_CACHE_KEY);
        if (!raw) return emptyCache();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyCache();
        const byName = parsed.byName && typeof parsed.byName === "object" && !Array.isArray(parsed.byName)
            ? parsed.byName
            : {};
        return { last: typeof parsed.last === "string" ? parsed.last : "", byName };
    } catch (e) {
        return emptyCache();
    }
}

function writeCache(cache) {
    try {
        localStorage.setItem(MAC_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
}

// 设备名里的完整地址：只接受 12 位十六进制，不拿 3-4 位后缀去猜 OUI
export function macFromDeviceName(name) {
    if (typeof name !== "string") return null;
    const upper = name.toUpperCase();
    const grouped = upper.match(/(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}/);
    if (grouped) return normalizeMac(grouped[0]);
    const plain = upper.match(/[0-9A-F]{12}/g);
    if (!plain) return null;
    return normalizeMac(plain[plain.length - 1]);
}

// MAC 解析顺序：手输 > 广播包 > 设备名 > 本地缓存
// 手输放最前，用户才有机会纠正错误的缓存
export function resolveMac({ typed, advertised, deviceName, cached } = {}) {
    const manual = normalizeMac(typed);
    if (manual) return { mac: manual, source: "manual" };
    const fromAdvertisement = normalizeMac(advertised);
    if (fromAdvertisement) return { mac: fromAdvertisement, source: "advertisement" };
    const fromName = macFromDeviceName(deviceName);
    if (fromName) return { mac: fromName, source: "name" };
    const saved = normalizeMac(cached);
    if (saved) return { mac: saved, source: "cache" };
    return { mac: "", source: "none" };
}

// 设备名优先，其次用上一次成功连接的地址（给弹窗预填用）
export function getCachedMac(deviceName) {
    const cache = readCache();
    if (deviceName && cache.byName[deviceName]) return cache.byName[deviceName];
    return cache.last || "";
}

// 只取这台设备的缓存，不用 last 兜底：换一台魔方时 last 很可能是错的
export function getDeviceMac(deviceName) {
    if (!deviceName) return "";
    return readCache().byName[deviceName] || "";
}

export function saveMac(deviceName, mac) {
    const normalized = normalizeMac(mac);
    if (!normalized) return "";
    const cache = readCache();
    cache.last = normalized;
    if (deviceName) cache.byName[deviceName] = normalized;
    writeCache(cache);
    return normalized;
}

export function clearMac(deviceName) {
    const cache = readCache();
    const removed = deviceName ? cache.byName[deviceName] : "";
    if (deviceName && removed) delete cache.byName[deviceName];
    if (removed && cache.last === removed) cache.last = "";
    writeCache(cache);
}

export function clearMacCache() {
    try {
        localStorage.removeItem(MAC_CACHE_KEY);
    } catch (e) {}
}
