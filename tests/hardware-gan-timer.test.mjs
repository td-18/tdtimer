import test from "node:test";
import assert from "node:assert/strict";
import {
    GAN_TIMER_STATE,
    crc16ccitt,
    decodeTimerState,
    formatTimerTime,
    isTimerFrame,
    makeTimerTime,
    parseRecordedTimes,
    parseTimerFrame,
} from "../src/hardware/protocols/gan-timer.js";

// 按设备格式拼帧：0xFE + 两字节头 + 从 byte3 开始的数据 + CRC（小端），
// CRC 覆盖 [2, len-2)。payload[0] 必须落在 byte3（状态位）。
function buildFrame(payloadFromState) {
    const bytes = Uint8Array.from([0xfe, 0x00, 0x00, ...payloadFromState]);
    const crc = crc16ccitt(bytes, 2, bytes.length);
    return Uint8Array.from([...bytes, crc & 0xff, crc >> 8]);
}

test("CRC-16/CCITT-FALSE 标准向量", () => {
    const text = Uint8Array.from("123456789", (char) => char.charCodeAt(0));
    assert.equal(crc16ccitt(text), 0x29b1);
});

test("计时器帧：CRC 通过才能解析", () => {
    const frame = buildFrame([GAN_TIMER_STATE.HANDS_ON]);
    assert.equal(isTimerFrame(frame), true);
    const parsed = parseTimerFrame(frame);
    assert.equal(parsed.state, GAN_TIMER_STATE.HANDS_ON);
    assert.equal(parsed.stateName, "手放上");
    assert.equal(parsed.recordedTime, null);

    const broken = Uint8Array.from(frame);
    broken[4] ^= 0xff;
    assert.equal(isTimerFrame(broken), false);
    assert.equal(parseTimerFrame(broken), null);
});

test("状态字节按索引表映射：原始 5 是设备复位，不是空闲", () => {
    assert.equal(GAN_TIMER_STATE.IDLE, 5);
    assert.equal(GAN_TIMER_STATE.GAN_RESET, 9);

    const reset = parseTimerFrame(buildFrame([5]));
    assert.equal(reset.rawState, 5);
    assert.equal(reset.state, GAN_TIMER_STATE.GAN_RESET);
    assert.equal(reset.stateName, "设备复位");
    assert.notEqual(reset.state, GAN_TIMER_STATE.IDLE);

    assert.equal(decodeTimerState(0), 0);
    assert.equal(decodeTimerState(4), 4);
    assert.equal(decodeTimerState(6), 6);
    assert.equal(decodeTimerState(7), 7);

    // 状态索引只有 0-7，越界不能当成未知状态继续用
    assert.equal(decodeTimerState(8), GAN_TIMER_STATE.DISCONNECT);
    assert.equal(decodeTimerState(9), GAN_TIMER_STATE.DISCONNECT);
    assert.equal(parseTimerFrame(buildFrame([9])).stateName, "已断开");
});

test("计时器帧：STOPPED 携带分 / 秒 / 毫秒（毫秒小端）", () => {
    // 1 分 02 秒 300 毫秒
    const frame = buildFrame([GAN_TIMER_STATE.STOPPED, 1, 2, 0x2c, 0x01]);
    const parsed = parseTimerFrame(frame);
    assert.equal(parsed.state, GAN_TIMER_STATE.STOPPED);
    assert.equal(parsed.recordedTime.asTimestamp, 62300);
    assert.equal(parsed.recordedTime.text, "1:02.300");
});

test("计时器帧：非 0xFE 开头或长度不足直接拒绝", () => {
    const frame = buildFrame([GAN_TIMER_STATE.IDLE]);
    const wrongMagic = Uint8Array.from(frame);
    wrongMagic[0] = 0xfd;
    assert.equal(isTimerFrame(wrongMagic), false);
    assert.equal(isTimerFrame(Uint8Array.from([0xfe, 0x00])), false);
    assert.equal(isTimerFrame(null), false);
});

test("历史成绩：16 字节拆成当前 + 最近三次", () => {
    const bytes = Uint8Array.from([
        0, 12, 0x34, 0x01,
        0, 11, 0x11, 0x00,
        0, 10, 0x22, 0x00,
        1, 0, 0x33, 0x00,
    ]);
    const times = parseRecordedTimes(bytes);
    assert.equal(times.displayTime.asTimestamp, 12308);
    assert.equal(times.previousTimes[0].asTimestamp, 11017);
    assert.equal(times.previousTimes[1].asTimestamp, 10034);
    assert.equal(times.previousTimes[2].asTimestamp, 60051);
    assert.equal(parseRecordedTimes(new Uint8Array(8)), null);
});

test("时间格式化", () => {
    assert.equal(formatTimerTime(makeTimerTime(0, 7, 5)), "0:07.005");
    assert.equal(formatTimerTime(null), "—");
});
