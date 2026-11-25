// WCA 打乱事件注册表（M1）
//
// 规则基线：WCA Regulations 2026-04-01，17 个官方项目。
// 说明：
// - 盲拧/单拧/多盲复用 3x3 打乱，FMC 不设专职打乱员（但仍需要 3x3 打乱）。
// - 4x4 在 M3 接入本地随机状态求解器；4BLD 仍走 legacy 随机朝向。
// - Clock / Square-1 在 M2 接入本地随机状态；5x5/6x6/7x7 在 M3 接入随机转动。
// - FTO 当前不在官方项目列表，预留在 2027 WCA 更新后启用。

export const RULES_VERSION = "2026-04-01";

export const LOCAL_STATUS = Object.freeze({
    PLANNED: "planned",         // 本地算法尚未实现，交给 legacy 兜底
    SCAFFOLDED: "scaffolded",   // provider 契约已接通，算法待后续里程碑
    READY: "ready",             // 本地 provider 可用
    DELEGATED: "delegated",     // 明确交给现有实现（4x4）
    RESERVED: "reserved",       // 暂不启用（FTO）
});

export const SCRAMBLERS = Object.freeze({
    "333": Object.freeze({
        id: "333",
        label: "3x3x3",
        legacyEventId: "333",
        local: LOCAL_STATUS.READY,
        note: "M1 已接入本地二阶段求解器；盲拧/多盲仍走 legacy 随机朝向",
    }),
    "222": Object.freeze({
        id: "222",
        label: "2x2x2",
        legacyEventId: "222",
        local: LOCAL_STATUS.READY,
        note: "M1 全状态 BFS 最优解（3,674,160 规范状态）",
    }),
    "444": Object.freeze({
        id: "444",
        label: "4x4x4",
        legacyEventId: "444",
        local: LOCAL_STATUS.READY,
        note: "M3 本地 4x4 随机状态求解器（reduction + 3x3）",
    }),
    "555": Object.freeze({
        id: "555",
        label: "5x5x5",
        legacyEventId: "555",
        local: LOCAL_STATUS.READY,
        note: "M3 本地随机转动 60 步，最多两层宽",
    }),
    "666": Object.freeze({
        id: "666",
        label: "6x6x6",
        legacyEventId: "666",
        local: LOCAL_STATUS.READY,
        note: "M3 本地随机转动 80 步，最多三层宽",
    }),
    "777": Object.freeze({
        id: "777",
        label: "7x7x7",
        legacyEventId: "777",
        local: LOCAL_STATUS.READY,
        note: "M3 本地随机转动 100 步，最多三层宽",
    }),
    "clock": Object.freeze({
        id: "clock",
        label: "Clock",
        legacyEventId: "clock",
        local: LOCAL_STATUS.READY,
        note: "M2 本地随机状态生成器（Z/12Z 线性代数，12^14 状态）",
    }),
    "minx": Object.freeze({
        id: "minx",
        label: "Megaminx",
        legacyEventId: "minx",
        local: LOCAL_STATUS.READY,
        note: "M4 本地 Pochmann 随机转动：7 行 × (5 组 R/D + U/U')",
    }),
    "pyra": Object.freeze({
        id: "pyra",
        label: "Pyraminx",
        legacyEventId: "pyram",
        local: LOCAL_STATUS.READY,
        note: "M1 全状态 BFS 最优解（933,120 可达状态）；cubing.js 的 event id 是 pyram",
    }),
    "skewb": Object.freeze({
        id: "skewb",
        label: "Skewb",
        legacyEventId: "skewb",
        local: LOCAL_STATUS.READY,
        note: "M1 全状态 BFS 最优解（3,149,280 可达状态）",
    }),
    "sq1": Object.freeze({
        id: "sq1",
        label: "Square-1",
        legacyEventId: "sq1",
        local: LOCAL_STATUS.READY,
        note: "M2 本地两阶段随机状态求解器（至少 11 个 /）",
    }),
    "fto": Object.freeze({
        id: "fto",
        label: "FTO",
        legacyEventId: "fto",
        local: LOCAL_STATUS.RESERVED,
        availableFrom: "2027",
        note: "等 WCA 正式更新项目后启用，M0 不生成",
    }),
});

function defineEvent(id, data) {
    return Object.freeze({
        id,
        official: true,
        scrambler: id,
        legacyEventId: id,
        minMoves: 2,
        targetMaxMoves: null,
        randomOrientation: false,
        randomMoves: false,
        dedupe: false,
        requireSlash: false,
        needsScrambler: true,
        note: "",
        ...data,
    });
}

export const EVENTS = Object.freeze([
    defineEvent("333", {
        name: "3x3x3 Cube",
        nameZh: "三阶",
        scrambler: "333",
        legacyEventId: "333",
        targetMaxMoves: 21,
    }),
    defineEvent("222", {
        name: "2x2x2 Cube",
        nameZh: "二阶",
        scrambler: "222",
        legacyEventId: "222",
        minMoves: 4,
        targetMaxMoves: 11,
    }),
    defineEvent("444", {
        name: "4x4x4 Cube",
        nameZh: "四阶",
        scrambler: "444",
        legacyEventId: "444",
        note: "M0 沿用现有实现",
    }),
    defineEvent("555", {
        name: "5x5x5 Cube",
        nameZh: "五阶",
        scrambler: "555",
        legacyEventId: "555",
        randomMoves: true,
    }),
    defineEvent("666", {
        name: "6x6x6 Cube",
        nameZh: "六阶",
        scrambler: "666",
        legacyEventId: "666",
        randomMoves: true,
    }),
    defineEvent("777", {
        name: "7x7x7 Cube",
        nameZh: "七阶",
        scrambler: "777",
        legacyEventId: "777",
        randomMoves: true,
    }),
    defineEvent("333oh", {
        name: "3x3x3 One-Handed",
        nameZh: "三阶单拧",
        scrambler: "333",
        legacyEventId: "333oh",
        targetMaxMoves: 21,
    }),
    defineEvent("333bf", {
        name: "3x3x3 Blindfolded",
        nameZh: "三阶盲拧",
        scrambler: "333",
        legacyEventId: "333bf",
        targetMaxMoves: 21,
        randomOrientation: true,
    }),
    defineEvent("333fm", {
        name: "3x3x3 Fewest Moves",
        nameZh: "三阶最少步",
        scrambler: "333",
        legacyEventId: "333fm",
        targetMaxMoves: 21,
        needsScrambler: false,
        note: "FMC 不设专职打乱员，但仍使用 3x3 打乱",
    }),
    defineEvent("333mbf", {
        name: "3x3x3 Multi-Blind",
        nameZh: "三阶多盲",
        scrambler: "333",
        legacyEventId: "333mbf",
        targetMaxMoves: 21,
        randomOrientation: true,
        dedupe: true,
        note: "同组内不得出现重复打乱",
    }),
    defineEvent("444bf", {
        name: "4x4x4 Blindfolded",
        nameZh: "四阶盲拧",
        scrambler: "444",
        legacyEventId: "444bf",
        randomOrientation: true,
    }),
    defineEvent("555bf", {
        name: "5x5x5 Blindfolded",
        nameZh: "五阶盲拧",
        scrambler: "555",
        legacyEventId: "555bf",
        minMoves: 2,
        randomOrientation: true,
    }),
    defineEvent("clock", {
        name: "Clock",
        nameZh: "魔表",
        scrambler: "clock",
        legacyEventId: "clock",
    }),
    defineEvent("minx", {
        name: "Megaminx",
        nameZh: "五魔方",
        scrambler: "minx",
        legacyEventId: "minx",
        randomMoves: true,
    }),
    defineEvent("pyra", {
        name: "Pyraminx",
        nameZh: "金字塔",
        scrambler: "pyra",
        legacyEventId: "pyram",
        minMoves: 6,
        targetMaxMoves: 11,
    }),
    defineEvent("skewb", {
        name: "Skewb",
        nameZh: "斜转",
        scrambler: "skewb",
        legacyEventId: "skewb",
        minMoves: 7,
        targetMaxMoves: 11,
    }),
    defineEvent("sq1", {
        name: "Square-1",
        nameZh: "SQ1",
        scrambler: "sq1",
        legacyEventId: "sq1",
        minMoves: 11,
        requireSlash: true,
        note: "打乱状态必须允许不先做 (x,y) 直接 /",
    }),
    defineEvent("fto", {
        name: "Face-Turning Octahedron",
        nameZh: "FTO",
        official: false,
        scrambler: "fto",
        legacyEventId: "fto",
        availableFrom: "2027",
        note: "等待 WCA 2027 更新后启用",
    }),
]);

const ALIASES = Object.freeze({
    "3x3": "333",
    "3x3x3": "333",
    "三阶": "333",
    "2x2": "222",
    "2x2x2": "222",
    "二阶": "222",
    "4x4": "444",
    "4x4x4": "444",
    "四阶": "444",
    "5x5": "555",
    "5x5x5": "555",
    "五阶": "555",
    "6x6": "666",
    "6x6x6": "666",
    "六阶": "666",
    "7x7": "777",
    "7x7x7": "777",
    "七阶": "777",
    "3oh": "333oh",
    "oh": "333oh",
    "单拧": "333oh",
    "3bld": "333bf",
    "blind": "333bf",
    "盲拧": "333bf",
    "fmc": "333fm",
    "3fm": "333fm",
    "最少步": "333fm",
    "multi": "333mbf",
    "mbf": "333mbf",
    "多盲": "333mbf",
    "4bld": "444bf",
    "5bld": "555bf",
    "megaminx": "minx",
    "mega": "minx",
    "五魔": "minx",
    "pyraminx": "pyra",
    "pyram": "pyra",
    "pyramid": "pyra",
    "金字塔": "pyra",
    "square1": "sq1",
    "square-1": "sq1",
    "sq-1": "sq1",
    "斜转": "skewb",
    "魔表": "clock",
    "fto": "fto",
});

export function normalizeEventId(id) {
    if (id === null || id === undefined) return "";
    const key = String(id).trim().toLowerCase();
    return ALIASES[key] || key;
}

export function getEvent(id) {
    const key = normalizeEventId(id);
    return EVENTS.find((event) => event.id === key) || null;
}

export function getScrambler(idOrEvent) {
    if (idOrEvent && typeof idOrEvent === "object") {
        return SCRAMBLERS[idOrEvent.scrambler] || null;
    }
    const event = getEvent(idOrEvent);
    const key = event ? event.scrambler : normalizeEventId(idOrEvent);
    return SCRAMBLERS[key] || null;
}

export function listOfficialEvents() {
    return EVENTS.filter((event) => event.official);
}

export function listScramblers() {
    return Object.values(SCRAMBLERS);
}

export function assertRegistry() {
    const ids = new Set();
    for (const event of EVENTS) {
        if (!event.id) throw new Error("事件缺少 id");
        if (ids.has(event.id)) throw new Error(`重复事件 id: ${event.id}`);
        ids.add(event.id);
        const scrambler = SCRAMBLERS[event.scrambler];
        if (!scrambler) throw new Error(`事件 ${event.id} 引用了未知 scrambler: ${event.scrambler}`);
        if (!Number.isInteger(event.minMoves) || event.minMoves < 1) {
            throw new Error(`事件 ${event.id} 的 minMoves 非法`);
        }
    }
    for (const scrambler of Object.values(SCRAMBLERS)) {
        if (!scrambler.legacyEventId) throw new Error(`scrambler ${scrambler.id} 缺少 legacyEventId`);
    }
    return true;
}
