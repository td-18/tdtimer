// 公式库分类配置：删除、更名、按解法分组
// 公式库界面和训练模式共用，避免两边分类不一致

// 暂不展示入口的项目（数据仍保留，后续可随时恢复）
export const HIDDEN_PUZZLES = ["fto"];

// 不展示的分类（CubeRoot 原始数据保留，只在公式库界面隐藏）
export const REMOVED_CATS = {
    "3x3": ["2-Look OLL", "2-Look PLL"],
};

// 分类更名
export const RENAMED_CATS = {
    "Adv F2L": "非标",
    "Pseudo F2L": "伪槽",
};

// 大类划分：按解法/学习路径把 CubeRoot 的分类归组
export const GROUP_DEFS = {
    "3x3": [
        { name: "CFOP", cats: ["F2L", "非标", "伪槽", "OLL", "PLL"] },
        { name: "CFOP 进阶", cats: ["COLL", "OLLCP", "1LLL", "ELL", "Anti-PLL", "CLS", "WV", "VLS", "SV", "FRUF"] },
        { name: "ZB", cats: ["ZBLS", "ZBLL"] },
        { name: "LSLL", cats: ["LSLL 两步", "LSLL 一步"] },
        { name: "桥式", cats: ["SBLS", "CMLL", "2-Look CMLL", "OH CMLL", "LSE-EOLR", "EO4A"] },
    ],
    "2x2": [
        { name: "Ortega", cats: ["OLL", "PBL"] },
        { name: "CLL", cats: ["CLL"] },
        { name: "EG", cats: ["EG1", "EG2", "LEG1", "TCLL+", "TCLL-", "TEG2+"] },
        { name: "LS", cats: ["LS1", "LS2", "LS3", "LS4", "LS5", "LS6", "LS7", "LS8", "LS9"] },
    ],
    "4x4": [
        { name: "奇偶", cats: ["OLL Parity", "PLL Parity"] },
    ],
    "5x5": [
        { name: "中心与棱", cats: ["L2C", "L2E"] },
    ],
    "6x6": [
        { name: "中心与棱", cats: ["L2C", "L2E"] },
    ],
    "fto": [
        { name: "Bencisco", cats: ["1L3T", "TCP", "PF", "TL", "LT"] },
    ],
    "megaminx": [
        { name: "顶层", cats: ["CO", "CP", "EO", "EP"] },
        { name: "PLL", cats: ["PLL"] },
    ],
    "pyraminx": [
        { name: "顶层", cats: ["L3E", "L4E"] },
    ],
    "skewb": [
        { name: "Sarah Advanced", cats: ["Sarah Advanced"] },
    ],
    "sq1": [
        { name: "形状", cats: ["CS"] },
        { name: "角块", cats: ["CO", "CP"] },
        { name: "棱块", cats: ["EO", "EP"] },
        { name: "CSP", cats: ["CSP"] },
        { name: "PBL", cats: ["PBL"] },
        { name: "OBL / 奇偶", cats: ["OBL", "Parity"] },
    ],
};

// 过滤/更名后保留原始顺序
export function normalizeCategories(puzzleKey, data) {
    const removed = REMOVED_CATS[puzzleKey] || [];
    const out = [];
    Object.keys(data).forEach((catKey) => {
        if (removed.indexOf(catKey) !== -1) return;
        out.push({ key: RENAMED_CATS[catKey] || catKey, cases: data[catKey] });
    });
    return out;
}

// 按大类归类，未覆盖到的分类自动进「其他」
export function groupCategories(puzzleKey, cats) {
    const defs = GROUP_DEFS[puzzleKey] || [];
    const names = cats.map((c) => c.key);
    const used = {};
    const groups = [];

    defs.forEach((def) => {
        const list = def.cats.filter((name) => names.indexOf(name) !== -1);
        if (!list.length) return;
        list.forEach((name) => (used[name] = true));
        groups.push({ name: def.name, cats: list });
    });

    const rest = names.filter((name) => !used[name]);
    if (rest.length) groups.push({ name: "其他", cats: rest });
    return groups;
}

// 取某训练分组的全部分类（[ { key, cases } ]）
export function getGroupCategories(puzzleKey, groupName) {
    const data = window.FormulaDB && window.FormulaDB[puzzleKey];
    if (!data) return [];

    const cats = normalizeCategories(puzzleKey, data);
    const group = groupCategories(puzzleKey, cats).find((g) => g.name === groupName);
    if (!group) return [];

    return group.cats
        .map((name) => cats.find((c) => c.key === name))
        .filter(Boolean);
}
