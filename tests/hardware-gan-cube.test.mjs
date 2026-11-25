import test from "node:test";
import assert from "node:assert/strict";
import {
    BitReader,
    GAN_GEN2_SERVICE,
    GAN_GEN3_SERVICE,
    GAN_GEN4_SERVICE,
    SOLVED_FACELETS,
    createDriver,
    toKociembaFacelets,
} from "../src/hardware/protocols/gan.js";
import { GAN_TIMER_SERVICE } from "../src/hardware/protocols/gan-timer.js";
import { detectProfile, requestOptions } from "../src/hardware/registry.js";

function bitWriter(length = 16) {
    const bits = new Uint8Array(length * 8);
    return {
        set(start, value, width) {
            for (let i = 0; i < width; i++) {
                bits[start + i] = (value >> (width - 1 - i)) & 1;
            }
        },
        bytes() {
            const out = new Uint8Array(length);
            for (let i = 0; i < out.length; i++) {
                let byte = 0;
                for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
                out[i] = byte;
            }
            return out;
        },
    };
}

test("服务 UUID 识别：魔方代际优先于计时器", () => {
    assert.deepEqual(detectProfile([GAN_GEN4_SERVICE]), { kind: "gan-cube", gen: 4, label: "GAN 智能魔方 Gen4" });
    assert.deepEqual(detectProfile([GAN_GEN2_SERVICE]), { kind: "gan-cube", gen: 2, label: "GAN 智能魔方 Gen2" });
    assert.equal(detectProfile([GAN_GEN3_SERVICE]).gen, 3);
    assert.deepEqual(detectProfile([GAN_TIMER_SERVICE]), { kind: "gan-timer", label: "GAN 智能计时器" });
    assert.equal(detectProfile(["0000180a-0000-1000-8000-00805f9b34fb"]), null);
});

test("请求参数：提前申请厂商数据，覆盖 GAN 的 CIC 段", () => {
    const options = requestOptions();
    assert.equal(Array.isArray(options.optionalManufacturerData), true);
    assert.equal(options.optionalManufacturerData.length, 256);
    assert.equal(options.optionalManufacturerData[0], 0x0001);
    assert.equal(options.optionalManufacturerData[255], 0xff01);
    assert.equal(options.filters.length > 0, true);
});

test("BitReader 与 DataView 小端一致", () => {
    const reader = new BitReader(Uint8Array.from([0x55, 0x03, 0x34, 0x12]));
    assert.equal(reader.get(0, 8), 0x55);
    assert.equal(reader.get(8, 8), 0x03);
    assert.equal(reader.get(16, 16, true), 0x1234);
    assert.equal(reader.get(16, 16), 0x3412);
});

test("面片转换：已复原状态对应标准 facelets", () => {
    const cp = [0, 1, 2, 3, 4, 5, 6, 7];
    const co = [0, 0, 0, 0, 0, 0, 0, 0];
    const ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert.equal(toKociembaFacelets(cp, co, ep, eo), SOLVED_FACELETS);
});

test("面片转换：F R 之后的已知状态", () => {
    const cp = [0, 5, 2, 1, 7, 4, 6, 3];
    const co = [1, 2, 0, 2, 1, 1, 0, 2];
    const ep = [1, 9, 2, 3, 11, 8, 6, 7, 4, 5, 10, 0];
    const eo = [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0];
    assert.equal(
        toKociembaFacelets(cp, co, ep, eo),
        "UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB",
    );
});

test("Gen4：电量事件", () => {
    const driver = createDriver(4);
    const message = new Uint8Array(16);
    message[0] = 0xef;
    message[1] = 0x01;
    message[2] = 55;
    const events = driver.handle(message, {});
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { type: "battery", batteryLevel: 55 });
});

test("Gen4：面片事件解出已复原", () => {
    const driver = createDriver(4);
    const writer = bitWriter(16);
    writer.set(0, 0xed, 8);
    writer.set(8, 0x0b, 8);
    writer.set(16, 0, 16);
    for (let i = 0; i < 7; i++) writer.set(32 + i * 3, i, 3);
    for (let i = 0; i < 7; i++) writer.set(53 + i * 2, 0, 2);
    for (let i = 0; i < 11; i++) writer.set(69 + i * 4, i, 4);
    for (let i = 0; i < 11; i++) writer.set(113 + i, 0, 1);
    const events = driver.handle(writer.bytes(), {});
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "facelets");
    assert.equal(events[0].facelets, SOLVED_FACELETS);
    assert.equal(events[0].solved, true);
});

test("Gen4：硬件信息帧逐片收齐后才发事件", () => {
    const driver = createDriver(4);
    const versionFrame = (eventType, major, minor) => {
        const writer = bitWriter(16);
        writer.set(0, eventType, 8);
        writer.set(8, 0x04, 8);
        writer.set(24, major, 4);
        writer.set(28, minor, 4);
        return writer.bytes();
    };
    const dateFrame = () => {
        const writer = bitWriter(16);
        writer.set(0, 0xfa, 8);
        writer.set(8, 0x05, 8);
        writer.set(24, 2026 & 0xff, 8);
        writer.set(32, 2026 >> 8, 8);
        writer.set(40, 11, 8);
        writer.set(48, 25, 8);
        return writer.bytes();
    };
    const nameFrame = () => {
        const writer = bitWriter(16);
        writer.set(0, 0xfc, 8);
        writer.set(8, 0x04, 8);
        for (let i = 0; i < 3; i++) writer.set(24 + i * 8, "GAN".charCodeAt(i), 8);
        return writer.bytes();
    };

    assert.deepEqual(driver.handle(versionFrame(0xfd, 1, 2), {}), []);
    driver.handle(versionFrame(0xfe, 2, 1), {});
    driver.handle(dateFrame(), {});
    const events = driver.handle(nameFrame(), {});
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "hardware");
    assert.equal(events[0].softwareVersion, "1.2");
    assert.equal(events[0].hardwareVersion, "2.1");
    assert.equal(events[0].hardwareName, "GAN");
    assert.equal(events[0].productDate, "2026-11-25");
});
