import test from "node:test";
import assert from "node:assert/strict";
import {
    clearMacCache,
    getCachedMac,
    getDeviceMac,
    macFromDeviceName,
    macToSalt,
    normalizeMac,
    resolveMac,
    saveMac,
} from "../src/hardware/mac.js";
import { extractMacFromManufacturerData, watchForMac } from "../src/hardware/transport.js";

test("MAC 归一化：接受常见分隔符和大写 / 小写", () => {
    assert.equal(normalizeMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
    assert.equal(normalizeMac("aa-bb-cc-dd-ee-ff"), "AA:BB:CC:DD:EE:FF");
    assert.equal(normalizeMac(" AA:BB:CC:DD:EE:FF "), "AA:BB:CC:DD:EE:FF");
    assert.equal(normalizeMac("AA:BB:CC:DD:EE"), null);
    assert.equal(normalizeMac("ZZ:BB:CC:DD:EE:FF"), null);
    assert.equal(normalizeMac(null), null);
});

test("MAC 转盐：倒序 6 字节", () => {
    assert.deepEqual(Array.from(macToSalt("11:22:33:44:55:66")), [0x66, 0x55, 0x44, 0x33, 0x22, 0x11]);
    assert.equal(macToSalt("bad"), null);
});

test("设备名：只接受完整 12 位地址，不猜短后缀", () => {
    assert.equal(macFromDeviceName("GAN14ui-AABBCCDDEEFF"), "AA:BB:CC:DD:EE:FF");
    assert.equal(macFromDeviceName("QY-QYSC-A-AA:BB:CC:DD:EE:FF"), "AA:BB:CC:DD:EE:FF");
    assert.equal(macFromDeviceName("GAN-14ui-1A2B"), null);
    assert.equal(macFromDeviceName("GAN356i"), null);
    assert.equal(macFromDeviceName(""), null);
    assert.equal(macFromDeviceName(null), null);
});

test("MAC 解析顺序：手输 > 广播 > 设备名 > 缓存", () => {
    const all = {
        typed: "11:11:11:11:11:11",
        advertised: "22:22:22:22:22:22",
        deviceName: "GAN14ui-333333333333",
        cached: "44:44:44:44:44:44",
    };
    assert.deepEqual(resolveMac(all), { mac: "11:11:11:11:11:11", source: "manual" });
    assert.deepEqual(resolveMac({ ...all, typed: "" }), { mac: "22:22:22:22:22:22", source: "advertisement" });
    assert.deepEqual(resolveMac({ ...all, typed: "", advertised: "" }), { mac: "33:33:33:33:33:33", source: "name" });
    assert.deepEqual(
        resolveMac({ typed: "", advertised: "", deviceName: "GAN14ui", cached: "44:44:44:44:44:44" }),
        { mac: "44:44:44:44:44:44", source: "cache" },
    );
    assert.deepEqual(resolveMac({ typed: "", advertised: "", deviceName: "GAN14ui", cached: "" }), { mac: "", source: "none" });
    assert.deepEqual(resolveMac({}), { mac: "", source: "none" });
});

test("厂商数据取 MAC：9 字节布局取末 6 字节倒序", () => {
    const view = new DataView(Uint8Array.from([0x00, 0x00, 0x00, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11]).buffer);
    assert.equal(extractMacFromManufacturerData(new Map([[0x0001, view]])), "11:22:33:44:55:66");
    assert.equal(extractMacFromManufacturerData(new Map([[0xff01, view]])), "11:22:33:44:55:66");
    assert.equal(extractMacFromManufacturerData(new Map([[0x1234, view]])), null);
    assert.equal(extractMacFromManufacturerData(new Map()), null);
    assert.equal(extractMacFromManufacturerData(null), null);
    assert.equal(extractMacFromManufacturerData(view), "11:22:33:44:55:66");

    const short = new DataView(Uint8Array.from([1, 2, 3, 4]).buffer);
    assert.equal(extractMacFromManufacturerData(new Map([[0x0001, short]])), null);
});

test("广播监听：收到厂商数据即返回 MAC，超时返回 null", async () => {
    class FakeDevice {
        constructor(manufacturerData) {
            this.manufacturerData = manufacturerData;
            this.handlers = {};
        }
        addEventListener(type, handler) {
            (this.handlers[type] = this.handlers[type] || []).push(handler);
        }
        removeEventListener(type, handler) {
            this.handlers[type] = (this.handlers[type] || []).filter((item) => item !== handler);
        }
        watchAdvertisements() {
            return Promise.resolve();
        }
        emit() {
            (this.handlers.advertisementreceived || []).forEach((handler) => {
                handler({ manufacturerData: this.manufacturerData });
            });
        }
    }

    const view = new DataView(Uint8Array.from([0, 0, 0, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11]).buffer);
    const device = new FakeDevice(new Map([[0x0001, view]]));
    const watch = watchForMac(device, 1000);
    device.emit();
    assert.equal(await watch.mac, "11:22:33:44:55:66");

    const idle = watchForMac(new FakeDevice(new Map()), 20);
    assert.equal(await idle.mac, null);

    const unsupported = watchForMac({}, 20);
    assert.equal(await unsupported.mac, null);
});

test("MAC 缓存：无 localStorage 时静默降级", () => {
    clearMacCache();
    assert.equal(getCachedMac("GAN-TEST"), "");
    assert.equal(getDeviceMac("GAN-TEST"), "");
    assert.equal(saveMac("GAN-TEST", "aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
    assert.equal(saveMac("GAN-TEST", "broken"), "");
});
