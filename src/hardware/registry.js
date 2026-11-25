// 设备画像：用 GATT 服务 UUID 判断连上的是什么
//
// Web Bluetooth 只能靠广播名 / 服务 UUID 区分设备，这里集中维护
// 名称前缀和需要提前申请的 optionalServices，新增品牌时只改本文件。

import {
    GAN_GEN2_SERVICE,
    GAN_GEN3_SERVICE,
    GAN_GEN4_SERVICE,
} from "./protocols/gan.js";
import { GAN_TIMER_SERVICE } from "./protocols/gan-timer.js";
import { GAN_CIC_LIST } from "./transport.js";

export const NAME_PREFIXES = ["GAN", "Gan", "gan", "MG", "AiCube"];

export const OPTIONAL_SERVICES = [
    GAN_TIMER_SERVICE,
    GAN_GEN2_SERVICE,
    GAN_GEN3_SERVICE,
    GAN_GEN4_SERVICE,
];

export const PROFILE_GAN_TIMER = { kind: "gan-timer", label: "GAN 智能计时器" };
export const PROFILE_GAN_CUBE = (gen) => ({ kind: "gan-cube", gen, label: `GAN 智能魔方 Gen${gen}` });

export function normalizeUUID(uuid) {
    return String(uuid || "").toLowerCase();
}

// 计时器与魔方共用 0xfff0 服务，魔方只有 Gen4 会用 00000010-...，
// 所以先判断魔方代际，再判断计时器。
export function detectProfile(serviceUUIDs) {
    const uuids = new Set(serviceUUIDs.map(normalizeUUID));
    if (uuids.has(normalizeUUID(GAN_GEN2_SERVICE))) return PROFILE_GAN_CUBE(2);
    if (uuids.has(normalizeUUID(GAN_GEN3_SERVICE))) return PROFILE_GAN_CUBE(3);
    if (uuids.has(normalizeUUID(GAN_GEN4_SERVICE))) return PROFILE_GAN_CUBE(4);
    if (uuids.has(normalizeUUID(GAN_TIMER_SERVICE))) return PROFILE_GAN_TIMER;
    return null;
}

export function requestOptions() {
    return {
        filters: NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
        optionalServices: OPTIONAL_SERVICES,
        // 只有带这个才能收到厂商广播数据；CIC 覆盖 0x0001..0xFF01
        optionalManufacturerData: GAN_CIC_LIST,
    };
}

export { GAN_TIMER_SERVICE, GAN_GEN2_SERVICE, GAN_GEN3_SERVICE, GAN_GEN4_SERVICE };
