// WCA 打乱模块入口（M1）
//
// 用法：
//   import { generateScramble } from "./scramble/wca/index.js";
//   const { scrambles } = await generateScramble("222");
//
// 同一个 API 会自动优先使用 worker 内的本地 provider；本地不可用或项目
// 仍处于 planned / scaffolded 状态时，回退到 legacy（cubing.js）。

export * from "./events.js";
export * from "./notation.js";
export * from "./rules.js";
export * from "./rng.js";
export * from "./protocol.js";
export { generateLegacy } from "./legacy.js";
export { ScrambleService } from "./client.js";

import { ScrambleService } from "./client.js";

let defaultService = null;

export function getScrambleService(options) {
    if (!defaultService) defaultService = new ScrambleService(options);
    return defaultService;
}

export function generateScramble(eventId, options = {}) {
    return getScrambleService().generate(eventId, options);
}

export function generateScrambleGroup(eventId, count, options = {}) {
    return getScrambleService().generateGroup(eventId, count, options);
}

export function getScrambleCapabilities(options) {
    return getScrambleService(options).getCapabilities();
}

export function disposeScrambleService() {
    if (defaultService) {
        defaultService.dispose();
        defaultService = null;
    }
}
