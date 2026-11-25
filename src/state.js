// 全局常量与共享状态
//
// pList 覆盖 WCA 全部 17 个官方项目，按“N×N / 三阶变体 / 盲拧 / 异形”分组。
// 字段说明：
//   key           项目唯一 id；成绩与切换都按它隔离（保留旧 key 以兼容已有成绩）
//   eventId       WCA 事件 id（与 src/scramble/wca/events.js 一致）
//   legacyEventId cubing.js 的事件 id（只有 Pyraminx 不同：pyram）
//   puzzle        twisty-player 的 puzzle 名称
//   local         本地 worker 生成器 id（离线可用；未提供则走 cubing.js）
//   group         下拉菜单里的分组标题
export const pList = [
    { key: "3x3x3", name: "三阶", eventId: "333", puzzle: "3x3x3", local: "333", group: "N×N" },
    { key: "2x2x2", name: "二阶", eventId: "222", puzzle: "2x2x2", local: "222", group: "N×N" },
    { key: "4x4x4", name: "四阶", eventId: "444", puzzle: "4x4x4", local: "444", group: "N×N" },
    { key: "5x5x5", name: "五阶", eventId: "555", puzzle: "5x5x5", local: "555", group: "N×N" },
    { key: "6x6x6", name: "六阶", eventId: "666", puzzle: "6x6x6", local: "666", group: "N×N" },
    { key: "7x7x7", name: "七阶", eventId: "777", puzzle: "7x7x7", local: "777", group: "N×N" },

    { key: "333oh", name: "三阶单拧", eventId: "333oh", puzzle: "3x3x3", local: "333", group: "三阶变体" },
    { key: "333bf", name: "三阶盲拧", eventId: "333bf", puzzle: "3x3x3", group: "三阶变体" },
    { key: "333fm", name: "三阶最少步", eventId: "333fm", puzzle: "3x3x3", local: "333", group: "三阶变体" },
    { key: "333mbf", name: "三阶多盲", eventId: "333mbf", puzzle: "3x3x3", group: "三阶变体" },

    { key: "444bf", name: "四阶盲拧", eventId: "444bf", puzzle: "4x4x4", group: "盲拧" },
    { key: "555bf", name: "五阶盲拧", eventId: "555bf", puzzle: "5x5x5", group: "盲拧" },

    { key: "clock", name: "魔表", eventId: "clock", puzzle: "clock", local: "clock", group: "异形" },
    { key: "minx", name: "五魔方", eventId: "minx", puzzle: "megaminx", local: "minx", group: "异形" },
    { key: "pyraminx", name: "金字塔", eventId: "pyra", legacyEventId: "pyram", puzzle: "pyraminx", local: "pyra", group: "异形" },
    { key: "skewb", name: "斜转", eventId: "skewb", puzzle: "skewb", local: "skewb", group: "异形" },
    { key: "sq1", name: "SQ1", eventId: "sq1", puzzle: "square1", local: "sq1", group: "异形" },
];

// cubing.js 不可用时，本地能给出的短打乱（仅兜底展示，不是正式随机状态）
const CUBE3 = ["R U R' U R U2 R'", "F R U R' U' F'", "R U R' U' R' F R2 U' R' U' R U R' F'"];
const CUBE_N = ["R U R' U' F' U F", "F R U R' U' F' U2", "R U2 R' U' R U' R'"];

export const fData = {
    "333": CUBE3,
    "333oh": CUBE3,
    "333bf": CUBE3,
    "333fm": CUBE3,
    "333mbf": CUBE3,
    "222": ["R U R' U'", "F R U R' U' F'", "R U2 R' U' R U' R'"],
    "444": CUBE_N,
    "555": CUBE_N,
    "666": CUBE_N,
    "777": CUBE_N,
    "444bf": CUBE_N,
    "555bf": CUBE_N,
    "pyra": ["R U L B", "R U' L' B", "U R L B'"],
    "skewb": ["R U R' U'", "R' L R L'", "R U B U'"],
};

export const state = {
    puzzle: pList[0],
    trainMode: null,   // [p, group, cat]，cat 为空表示整个分组，例如 ["3x3", "CFOP", "OLL"]
    trainCase: "",
    scramble: "",
    observe: false,
};

export function getRandomAUF() {
    const aufs = ["", "U ", "U' ", "U2 "];
    return aufs[Math.floor(Math.random() * aufs.length)];
}
