// GAN 智能计时器协议
//
// 只读特征 0x2A? 不涉及；设备侧只发通知：
//   service  0000fff0-0000-1000-8000-00805f9b34fb
//   状态     0000fff5-...（0xFE 开头，末 2 字节 CRC16-CCITT，状态在 byte3）
//   成绩     0000fff2-...（读一次返回 16 字节：当前 + 最近 3 次）
// 参考：gan-web-bluetooth（MIT）的 gan-smart-timer.ts，
// 帧格式与 CRC 覆盖范围照该实现核对过。

export const GAN_TIMER_SERVICE = "0000fff0-0000-1000-8000-00805f9b34fb";
export const GAN_TIMER_TIME_CHARACTERISTIC = "0000fff2-0000-1000-8000-00805f9b34fb";
export const GAN_TIMER_STATE_CHARACTERISTIC = "0000fff5-0000-1000-8000-00805f9b34fb";

export const GAN_TIMER_STATE = {
    DISCONNECT: 0,
    GET_SET: 1,
    HANDS_OFF: 2,
    RUNNING: 3,
    STOPPED: 4,
    IDLE: 5,
    HANDS_ON: 6,
    FINISHED: 7,
    GAN_RESET: 9,
};

// byte3 是「状态索引」，不是上面的常量序号：
// 索引 5 对应 GAN_RESET（常量 9），不是 IDLE（常量 5）。
// 越界索引按 DISCONNECT 处理，与 csTimer 的 `|| 0` 行为一致。
export const GAN_TIMER_STATE_TABLE = [
    0, // DISCONNECT
    1, // GET_SET
    2, // HANDS_OFF
    3, // RUNNING
    4, // STOPPED
    9, // GAN_RESET
    6, // HANDS_ON
    7, // FINISHED
];

export function decodeTimerState(rawIndex) {
    const state = GAN_TIMER_STATE_TABLE[rawIndex];
    return state === undefined ? 0 : state;
}

export const GAN_TIMER_STATE_NAME = {
    0: "已断开",
    1: "就绪",
    2: "手离开",
    3: "计时中",
    4: "已停止",
    5: "空闲",
    6: "手放上",
    7: "已完成",
    9: "设备复位",
};

// CRC-16/CCITT-FALSE：初值 0xFFFF，多项式 0x1021
export function crc16ccitt(bytes, start = 0, end = bytes.length) {
    let crc = 0xffff;
    for (let i = start; i < end; i++) {
        crc ^= (bytes[i] & 0xff) << 8;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xffff;
        }
    }
    return crc;
}

// 校验 0xFE 帧；CRC 只覆盖 [2, len-2)，与 gan-web-bluetooth 一致
export function isTimerFrame(bytes) {
    if (!bytes || bytes.length < 6) return false;
    if (bytes[0] !== 0xfe) return false;
    const expected = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
    return crc16ccitt(bytes, 2, bytes.length - 2) === expected;
}

export function makeTimerTime(minutes, seconds, milliseconds) {
    return {
        minutes,
        seconds,
        milliseconds,
        asTimestamp: minutes * 60000 + seconds * 1000 + milliseconds,
        text: `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`,
    };
}

// 成绩区固定 4 字节：分 / 秒 / 毫秒（小端 16 位）
export function readTimerTime(bytes, offset) {
    if (!bytes || offset + 4 > bytes.length) return null;
    return makeTimerTime(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2] | (bytes[offset + 3] << 8),
    );
}

// 返回 { state, rawState, stateName, recordedTime }；非法帧返回 null
export function parseTimerFrame(bytes) {
    if (!isTimerFrame(bytes)) return null;
    const rawState = bytes[3];
    const state = decodeTimerState(rawState);
    const frame = {
        state,
        rawState,
        stateName: GAN_TIMER_STATE_NAME[state] || `未知(${state})`,
        recordedTime: null,
    };
    if (state === GAN_TIMER_STATE.STOPPED) {
        frame.recordedTime = readTimerTime(bytes, 4);
    }
    return frame;
}

// 0xfff2 读取结果：当前成绩 + 最近三次，按时间倒序
export function parseRecordedTimes(bytes) {
    if (!bytes || bytes.length < 16) return null;
    return {
        displayTime: readTimerTime(bytes, 0),
        previousTimes: [readTimerTime(bytes, 4), readTimerTime(bytes, 8), readTimerTime(bytes, 12)],
    };
}

export function formatTimerTime(time) {
    if (!time) return "—";
    return time.text;
}
