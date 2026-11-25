// 本地 solver 注册入口（M1）
//
// M1 真实求解：333 / 222 / pyra / skewb。
// Clock / Square-1 / Megaminx 先接通 provider 契约，generate 返回
// DELEGATE_LEGACY，等 M2 / M4 替换算法；4x4 仍由现有实现负责。

import { registerProvider } from "../providers.js";
import { createThreeByThreeProvider } from "./333/provider.js";
import { createTwoByTwoProvider } from "./222/provider.js";
import { createFourByFourProvider } from "./444/provider.js";
import { createPyraminxProvider } from "./pyra/provider.js";
import { createSkewbProvider } from "./skewb/provider.js";
import { createClockProvider } from "./clock/provider.js";
import { createSquareOneProvider } from "./sq1/provider.js";
import { createFiveByFiveProvider } from "./555/provider.js";
import { createSixBySixProvider } from "./666/provider.js";
import { createSevenBySevenProvider } from "./777/provider.js";
import { createMegaminxProvider } from "./minx/provider.js";

export function registerBuiltinProviders() {
    registerProvider("333", createThreeByThreeProvider());
    registerProvider("222", createTwoByTwoProvider());
    registerProvider("444", createFourByFourProvider());
    registerProvider("pyra", createPyraminxProvider());
    registerProvider("skewb", createSkewbProvider());

    registerProvider("clock", createClockProvider());
    registerProvider("sq1", createSquareOneProvider());
    registerProvider("555", createFiveByFiveProvider());
    registerProvider("666", createSixBySixProvider());
    registerProvider("777", createSevenBySevenProvider());
    registerProvider("minx", createMegaminxProvider());
}
