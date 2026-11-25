// GAN 智能魔方协议（Gen2 / Gen3 / Gen4）
//
// 结构照 gan-web-bluetooth（MIT, Andy Fedotov）的 gan-cube-protocol.ts 移植，
// 去掉 RxJS 和异步驱动，改成纯函数式解析：输入解密后的字节，输出事件数组。
// 密钥/IV 常量同样来自该库的 gan-cube-definitions.ts。
//
// M1 范围：
//   - 代际识别、密钥派生、硬件信息 / 电量 / 面片 / 转动事件
//   - Gen3 / Gen4 保留丢帧补齐（历史窗口请求）
//   - 不做：陀螺仪联动、成绩回放、已复原自动停止

import { cbcDecrypt, cbcEncrypt } from "../aes.js";
import { macToSalt } from "../mac.js";

export const GAN_GEN2_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dc4179";
export const GAN_GEN2_COMMAND_CHARACTERISTIC = "28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4";
export const GAN_GEN2_STATE_CHARACTERISTIC = "28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4";

export const GAN_GEN3_SERVICE = "8653000a-43e6-47b7-9cb0-5fc21d4ae340";
export const GAN_GEN3_COMMAND_CHARACTERISTIC = "8653000c-43e6-47b7-9cb0-5fc21d4ae340";
export const GAN_GEN3_STATE_CHARACTERISTIC = "8653000b-43e6-47b7-9cb0-5fc21d4ae340";

export const GAN_GEN4_SERVICE = "00000010-0000-fff7-fff6-fff5fff4fff0";
export const GAN_GEN4_COMMAND_CHARACTERISTIC = "0000fff5-0000-1000-8000-00805f9b34fb";
export const GAN_GEN4_STATE_CHARACTERISTIC = "0000fff6-0000-1000-8000-00805f9b34fb";

// 互操作性常量：由社区逆向得到的固定密钥基底，仅用于与本设备通讯
export const GAN_KEY_BASE = new Uint8Array([
    0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
    0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);

export const GAN_IV_BASE = new Uint8Array([
    0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
    0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

export const SOLVED_FACELETS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

const CORNER_FACELET_MAP = [
    [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
    [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];

const EDGE_FACELET_MAP = [
    [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
    [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];

export function toKociembaFacelets(cp, co, ep, eo) {
    const faces = "URFDLB";
    const facelets = [];
    for (let i = 0; i < 54; i++) facelets[i] = faces[~~(i / 9)];
    for (let i = 0; i < 8; i++) {
        for (let p = 0; p < 3; p++) {
            facelets[CORNER_FACELET_MAP[i][(p + co[i]) % 3]] =
                faces[~~(CORNER_FACELET_MAP[cp[i]][p] / 9)];
        }
    }
    for (let i = 0; i < 12; i++) {
        for (let p = 0; p < 2; p++) {
            facelets[EDGE_FACELET_MAP[i][(p + eo[i]) % 2]] =
                faces[~~(EDGE_FACELET_MAP[ep[i]][p] / 9)];
        }
    }
    return facelets.join("");
}

// GAN 的 CBC 每个 16 字节块都用同一组 key/iv，且只处理首块和末块
export function createEncrypter(mac, key = GAN_KEY_BASE, iv = GAN_IV_BASE) {
    const salt = macToSalt(mac);
    if (!salt) throw new Error("无效的 MAC 地址");
    const saltedKey = new Uint8Array(key);
    const saltedIv = new Uint8Array(iv);
    for (let i = 0; i < 6; i++) {
        saltedKey[i] = (key[i] + salt[i]) % 0xff;
        saltedIv[i] = (iv[i] + salt[i]) % 0xff;
    }
    return {
        key: saltedKey,
        iv: saltedIv,
        encrypt(data) {
            if (data.length < 16) throw new Error("GAN 数据至少 16 字节");
            const out = new Uint8Array(data);
            out.set(cbcEncrypt(out.slice(0, 16), saltedKey, saltedIv), 0);
            if (out.length > 16) {
                const off = out.length - 16;
                out.set(cbcEncrypt(out.slice(off, off + 16), saltedKey, saltedIv), off);
            }
            return out;
        },
        decrypt(data) {
            if (data.length < 16) throw new Error("GAN 数据至少 16 字节");
            const out = new Uint8Array(data);
            if (out.length > 16) {
                const off = out.length - 16;
                out.set(cbcDecrypt(out.slice(off, off + 16), saltedKey, saltedIv), off);
            }
            out.set(cbcDecrypt(out.slice(0, 16), saltedKey, saltedIv), 0);
            return out;
        },
    };
}

export class BitReader {
    constructor(bytes) {
        this.bits = Array.from(bytes, (byte) => (byte + 0x100).toString(2).slice(1)).join("");
    }

    get(startBit, bitLength, littleEndian = false) {
        if (bitLength <= 8) return parseInt(this.bits.slice(startBit, startBit + bitLength) || "0", 2);
        if (bitLength === 16 || bitLength === 32) {
            const buf = new Uint8Array(bitLength / 8);
            for (let i = 0; i < buf.length; i++) {
                buf[i] = parseInt(this.bits.slice(8 * i + startBit, 8 * i + startBit + 8), 2);
            }
            const dv = new DataView(buf.buffer);
            return bitLength === 16 ? dv.getUint16(0, littleEndian) : dv.getUint32(0, littleEndian);
        }
        throw new Error("不支持的位宽");
    }
}

function decodeFacelets(msg, offsets) {
    const cp = [];
    const co = [];
    const ep = [];
    const eo = [];
    for (let i = 0; i < 7; i++) {
        cp.push(msg.get(offsets.cp + i * 3, 3));
        co.push(msg.get(offsets.co + i * 2, 2));
    }
    cp.push(28 - cp.reduce((a, v) => a + v, 0));
    co.push((3 - (co.reduce((a, v) => a + v, 0) % 3)) % 3);
    for (let i = 0; i < 11; i++) {
        ep.push(msg.get(offsets.ep + i * 4, 4));
        eo.push(msg.get(offsets.eo + i, 1));
    }
    ep.push(66 - ep.reduce((a, v) => a + v, 0));
    eo.push((2 - (eo.reduce((a, v) => a + v, 0) % 2)) % 2);
    return { cp, co, ep, eo };
}

function faceletsEvent(serial, state) {
    const facelets = toKociembaFacelets(state.cp, state.co, state.ep, state.eo);
    return {
        type: "facelets",
        serial,
        facelets,
        solved: facelets === SOLVED_FACELETS,
        state,
    };
}

function moveName(face, direction) {
    const letter = "URFDLB".charAt(face);
    if (!letter) return "";
    return letter + (direction ? "'" : "");
}

// 公共的串号 / 丢帧窗口逻辑（Gen3、Gen4 共用）
class BufferedDriver {
    constructor() {
        this.serial = -1;
        this.lastSerial = -1;
        this.lastLocalTimestamp = null;
        this.moveBuffer = [];
        this.cubeTimestamp = 0;
        this.lastMoveTimestamp = 0;
        this.hwInfo = {};
    }

    evictMoveBuffer(io) {
        const events = [];
        while (this.moveBuffer.length > 0) {
            const head = this.moveBuffer[0];
            const diff = this.lastSerial === -1 ? 1 : (head.serial - this.lastSerial) & 0xff;
            if (diff > 1) {
                if (io) this.requestMoveHistory(io, head.serial, diff);
                break;
            }
            events.push(this.moveBuffer.shift());
            this.lastSerial = head.serial;
        }
        if (io && this.moveBuffer.length > 16) io.disconnect();
        return events;
    }

    isSerialInRange(start, end, serial, closedStart = false, closedEnd = false) {
        return ((end - start) & 0xff) >= ((serial - start) & 0xff)
            && (closedStart || ((start - serial) & 0xff) > 0)
            && (closedEnd || ((end - serial) & 0xff) > 0);
    }

    injectMissedMove(move) {
        if (this.moveBuffer.length > 0) {
            const head = this.moveBuffer[0];
            if (this.moveBuffer.some((e) => e.serial === move.serial)) return;
            if (!this.isSerialInRange(this.lastSerial, head.serial, move.serial)) return;
            if (move.serial === ((head.serial - 1) & 0xff)) this.moveBuffer.unshift(move);
        } else if (this.isSerialInRange(this.lastSerial, this.serial, move.serial, false, true)) {
            this.moveBuffer.unshift(move);
        }
    }

    checkIfMoveMissed(io) {
        const diff = (this.serial - this.lastSerial) & 0xff;
        if (diff > 0 && this.serial !== 0) {
            const head = this.moveBuffer[0];
            const startSerial = head ? head.serial : (this.serial + 1) & 0xff;
            this.requestMoveHistory(io, startSerial, diff + 1);
        }
    }

    // 子类实现：按代际生成历史窗口请求
    requestMoveHistory(io, serial, count) {
        void io;
        void serial;
        void count;
    }
}

class GanGen2Driver extends BufferedDriver {
    command(type) {
        const msg = new Uint8Array(20);
        switch (type) {
            case "facelets": msg[0] = 0x04; break;
            case "hardware": msg[0] = 0x05; break;
            case "battery": msg[0] = 0x09; break;
            default: return null;
        }
        return msg;
    }

    handle(bytes, io) {
        const msg = new BitReader(bytes);
        const eventType = msg.get(0, 4);
        const events = [];
        const now = io && io.now ? io.now() : Date.now();

        if (eventType === 0x01) {
            const qw = msg.get(4, 16);
            const qx = msg.get(20, 16);
            const qy = msg.get(36, 16);
            const qz = msg.get(52, 16);
            events.push({
                type: "gyro",
                quaternion: {
                    x: (1 - (qx >> 15) * 2) * (qx & 0x7fff) / 0x7fff,
                    y: (1 - (qy >> 15) * 2) * (qy & 0x7fff) / 0x7fff,
                    z: (1 - (qz >> 15) * 2) * (qz & 0x7fff) / 0x7fff,
                    w: (1 - (qw >> 15) * 2) * (qw & 0x7fff) / 0x7fff,
                },
            });
        } else if (eventType === 0x02) {
            if (this.lastSerial !== -1) {
                const serial = msg.get(4, 8);
                const diff = Math.min((serial - this.lastSerial) & 0xff, 7);
                this.lastSerial = serial;
                if (diff > 0) {
                    for (let i = diff - 1; i >= 0; i--) {
                        const face = msg.get(12 + 5 * i, 4);
                        const direction = msg.get(16 + 5 * i, 1);
                        let elapsed = msg.get(47 + 16 * i, 16);
                        if (elapsed === 0) elapsed = now - this.lastMoveTimestamp;
                        this.cubeTimestamp += elapsed;
                        events.push({
                            type: "move",
                            serial: (serial - i) & 0xff,
                            face,
                            direction,
                            move: moveName(face, direction),
                            cubeTimestamp: this.cubeTimestamp,
                        });
                    }
                    this.lastMoveTimestamp = now;
                }
            }
        } else if (eventType === 0x04) {
            const serial = msg.get(4, 8);
            if (this.lastSerial === -1) this.lastSerial = serial;
            this.serial = serial;
            events.push(faceletsEvent(serial, decodeFacelets(msg, { cp: 12, co: 33, ep: 47, eo: 91 })));
        } else if (eventType === 0x05) {
            let hardwareName = "";
            for (let i = 0; i < 8; i++) hardwareName += String.fromCharCode(msg.get(i * 8 + 40, 8));
            events.push({
                type: "hardware",
                hardwareName,
                hardwareVersion: `${msg.get(8, 8)}.${msg.get(16, 8)}`,
                softwareVersion: `${msg.get(24, 8)}.${msg.get(32, 8)}`,
                gyroSupported: !!msg.get(104, 1),
            });
        } else if (eventType === 0x09) {
            events.push({ type: "battery", batteryLevel: Math.min(msg.get(8, 8), 100) });
        } else if (eventType === 0x0d) {
            if (io) io.disconnect();
        }
        return events;
    }
}

class GanGen3Driver extends BufferedDriver {
    command(type) {
        const msg = new Uint8Array(16);
        switch (type) {
            case "facelets": msg.set([0x68, 0x01]); break;
            case "hardware": msg.set([0x68, 0x04]); break;
            case "battery": msg.set([0x68, 0x07]); break;
            default: return null;
        }
        return msg;
    }

    requestMoveHistory(io, serial, count) {
        let s = serial;
        let c = count;
        if (s % 2 === 0) s = (s - 1) & 0xff;
        if (c % 2 === 1) c++;
        c = Math.min(c, s + 1);
        const msg = new Uint8Array(16);
        msg.set([0x68, 0x03, s, 0, c, 0]);
        io.send(msg);
    }

    handle(bytes, io) {
        const msg = new BitReader(bytes);
        const events = [];
        const now = io && io.now ? io.now() : Date.now();
        const magic = msg.get(0, 8);
        const eventType = msg.get(8, 8);
        const dataLength = msg.get(16, 8);
        if (magic !== 0x55 || dataLength === 0) return events;

        if (eventType === 0x01) {
            const cubeTimestamp = msg.get(24, 32, true);
            const serial = msg.get(56, 16, true);
            const direction = msg.get(72, 2);
            const face = [2, 32, 8, 1, 16, 4].indexOf(msg.get(74, 6));
            this.serial = serial;
            if (this.lastSerial !== -1) {
                this.lastLocalTimestamp = now;
                if (face >= 0) {
                    this.moveBuffer.push({
                        type: "move",
                        serial,
                        face,
                        direction,
                        move: moveName(face, direction),
                        cubeTimestamp,
                        localTimestamp: now,
                    });
                }
                events.push(...this.evictMoveBuffer(io));
            }
        } else if (eventType === 0x06) {
            const startSerial = msg.get(24, 8);
            const count = (dataLength - 1) * 2;
            for (let i = 0; i < count; i++) {
                const face = [1, 5, 3, 0, 4, 2].indexOf(msg.get(32 + 4 * i, 3));
                const direction = msg.get(35 + 4 * i, 1);
                if (face < 0) continue;
                this.injectMissedMove({
                    type: "move",
                    serial: (startSerial - i) & 0xff,
                    face,
                    direction,
                    move: moveName(face, direction),
                    cubeTimestamp: null,
                    localTimestamp: null,
                });
            }
            events.push(...this.evictMoveBuffer());
        } else if (eventType === 0x02) {
            const serial = msg.get(24, 16, true);
            this.serial = serial;
            if (this.lastSerial !== -1 && this.lastLocalTimestamp !== null
                && now - this.lastLocalTimestamp > 500) {
                this.checkIfMoveMissed(io);
            }
            if (this.lastSerial === -1) this.lastSerial = serial;
            events.push(faceletsEvent(serial, decodeFacelets(msg, { cp: 40, co: 61, ep: 77, eo: 121 })));
        } else if (eventType === 0x07) {
            let hardwareName = "";
            for (let i = 0; i < 5; i++) hardwareName += String.fromCharCode(msg.get(i * 8 + 32, 8));
            events.push({
                type: "hardware",
                hardwareName,
                softwareVersion: `${msg.get(72, 4)}.${msg.get(76, 4)}`,
                hardwareVersion: `${msg.get(80, 4)}.${msg.get(84, 4)}`,
                gyroSupported: false,
            });
        } else if (eventType === 0x10) {
            events.push({ type: "battery", batteryLevel: Math.min(msg.get(24, 8), 100) });
        } else if (eventType === 0x11) {
            if (io) io.disconnect();
        }
        return events;
    }
}

class GanGen4Driver extends BufferedDriver {
    command(type) {
        const msg = new Uint8Array(20);
        switch (type) {
            case "facelets": msg.set([0xdd, 0x04, 0x00, 0xed, 0x00, 0x00]); break;
            case "hardware":
                this.hwInfo = {};
                msg.set([0xdf, 0x03, 0x00, 0x00, 0x00]);
                break;
            case "battery": msg.set([0xdd, 0x04, 0x00, 0xef, 0x00, 0x00]); break;
            default: return null;
        }
        return msg;
    }

    requestMoveHistory(io, serial, count) {
        let s = serial;
        let c = count;
        if (s % 2 === 0) s = (s - 1) & 0xff;
        if (c % 2 === 1) c++;
        c = Math.min(c, s + 1);
        const msg = new Uint8Array(20);
        msg.set([0xd1, 0x04, s, 0, c, 0]);
        io.send(msg);
    }

    handle(bytes, io) {
        const msg = new BitReader(bytes);
        const events = [];
        const now = io && io.now ? io.now() : Date.now();
        const eventType = msg.get(0, 8);
        const dataLength = msg.get(8, 8);

        if (eventType === 0x01) {
            const cubeTimestamp = msg.get(16, 32, true);
            const serial = msg.get(48, 16, true);
            const direction = msg.get(64, 2);
            const face = [2, 32, 8, 1, 16, 4].indexOf(msg.get(66, 6));
            this.serial = serial;
            if (this.lastSerial !== -1) {
                this.lastLocalTimestamp = now;
                if (face >= 0) {
                    this.moveBuffer.push({
                        type: "move",
                        serial,
                        face,
                        direction,
                        move: moveName(face, direction),
                        cubeTimestamp,
                        localTimestamp: now,
                    });
                }
                events.push(...this.evictMoveBuffer(io));
            }
        } else if (eventType === 0xd1) {
            const startSerial = msg.get(16, 8);
            const count = (dataLength - 1) * 2;
            for (let i = 0; i < count; i++) {
                const face = [1, 5, 3, 0, 4, 2].indexOf(msg.get(24 + 4 * i, 3));
                const direction = msg.get(27 + 4 * i, 1);
                if (face < 0) continue;
                this.injectMissedMove({
                    type: "move",
                    serial: (startSerial - i) & 0xff,
                    face,
                    direction,
                    move: moveName(face, direction),
                    cubeTimestamp: null,
                    localTimestamp: null,
                });
            }
            events.push(...this.evictMoveBuffer());
        } else if (eventType === 0xed) {
            const serial = msg.get(16, 16, true);
            this.serial = serial;
            if (this.lastSerial !== -1 && this.lastLocalTimestamp !== null
                && now - this.lastLocalTimestamp > 500) {
                this.checkIfMoveMissed(io);
            }
            if (this.lastSerial === -1) this.lastSerial = serial;
            events.push(faceletsEvent(serial, decodeFacelets(msg, { cp: 32, co: 53, ep: 69, eo: 113 })));
        } else if (eventType >= 0xfa && eventType <= 0xfe) {
            // 硬件信息分 4 帧返回（生产日期 / 名称 / 软件 / 硬件），收齐再发事件
            switch (eventType) {
                case 0xfa: {
                    const year = msg.get(24, 16, true);
                    const month = msg.get(40, 8);
                    const day = msg.get(48, 8);
                    this.hwInfo[eventType] = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    break;
                }
                case 0xfc: {
                    let name = "";
                    for (let i = 0; i < dataLength - 1; i++) name += String.fromCharCode(msg.get(i * 8 + 24, 8));
                    this.hwInfo[eventType] = name;
                    break;
                }
                case 0xfd:
                    this.hwInfo[eventType] = `${msg.get(24, 4)}.${msg.get(28, 4)}`;
                    break;
                case 0xfe:
                    this.hwInfo[eventType] = `${msg.get(24, 4)}.${msg.get(28, 4)}`;
                    break;
            }
            if (Object.keys(this.hwInfo).length === 4) {
                events.push({
                    type: "hardware",
                    hardwareName: this.hwInfo[0xfc],
                    softwareVersion: this.hwInfo[0xfd],
                    hardwareVersion: this.hwInfo[0xfe],
                    productDate: this.hwInfo[0xfa],
                    gyroSupported: this.hwInfo[0xfc] === "GAN12uiM",
                });
            }
        } else if (eventType === 0xec) {
            const qw = msg.get(16, 16);
            const qx = msg.get(32, 16);
            const qy = msg.get(48, 16);
            const qz = msg.get(64, 16);
            events.push({
                type: "gyro",
                quaternion: {
                    x: (1 - (qx >> 15) * 2) * (qx & 0x7fff) / 0x7fff,
                    y: (1 - (qy >> 15) * 2) * (qy & 0x7fff) / 0x7fff,
                    z: (1 - (qz >> 15) * 2) * (qz & 0x7fff) / 0x7fff,
                    w: (1 - (qw >> 15) * 2) * (qw & 0x7fff) / 0x7fff,
                },
            });
        } else if (eventType === 0xef) {
            events.push({ type: "battery", batteryLevel: Math.min(msg.get(8 + dataLength * 8, 8), 100) });
        } else if (eventType === 0xea) {
            if (io) io.disconnect();
        }
        return events;
    }
}

export function createDriver(gen) {
    if (gen === 2) return new GanGen2Driver();
    if (gen === 3) return new GanGen3Driver();
    if (gen === 4) return new GanGen4Driver();
    throw new Error(`不支持的 GAN 代际：${gen}`);
}
