// 公式库二级分类：分类 → 家族（如 ZBLL → AS / H / L / Pi / S / T / U）→ case。
//
// 三阶 / 二阶的大部分分类在 case 名称里自带家族前缀（例如「ZBLL AS 1」、
// 「LS-4 Pi-A 3」），这里只按名称拆分，不改动公式数据。
// 没有家族信息的分类（如 OLL 1…57、PLL、VLS）返回空数组，界面仍按原来的
// 「分类 → 状态 → 公式」展示，避免为了分层而硬凑分组。

function collectFamilies(cases, keyOf, order) {
    const map = new Map();
    cases.forEach((row) => {
        const name = String((row && row[0]) || "");
        const key = keyOf(name) || "其他";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    });

    const keys = [];
    (order || []).forEach((key) => {
        if (map.has(key)) keys.push(key);
    });
    map.forEach((_, key) => {
        if (keys.indexOf(key) === -1) keys.push(key);
    });

    return keys.map((key) => ({ key, cases: map.get(key) }));
}

// 「前缀 + 家族名 + 末尾序号」：CLL AS 1 → AS，LS-8 Pinwheel-Poser A 1 → Pinwheel-Poser A。
function afterPrefix(prefix) {
    const head = prefix + " ";
    return (name) => {
        if (name.indexOf(head) !== 0) return "";
        return name.slice(head.length).replace(/\s+\d+$/, "").trim();
    };
}

function firstToken(name) {
    return name.split(/\s+/)[0] || "";
}

// 按最长前缀匹配，避免「Pinwheel」抢走「Pinwheel Poser」。
function matchingPrefix(prefixes) {
    const sorted = prefixes.slice().sort((a, b) => b.length - a.length);
    return (name) => {
        for (let i = 0; i < sorted.length; i++) {
            const prefix = sorted[i];
            if (name === prefix || name.indexOf(prefix + " ") === 0) return prefix;
        }
        return "";
    };
}

const OLL_GROUP_ORDER = [
    "AS", "H", "L", "Pi", "S", "T", "U",
];

const RULES = {
    "3x3": {
        // COLL / ZBLL：AS、H、L、Pi、S、T、U 七个方向。
        // COLL 的 case 名不带分类前缀（AS 1），ZBLL 带（ZBLL AS 1）。
        COLL: { keyOf: firstToken, order: OLL_GROUP_ORDER },
        ZBLL: { keyOf: afterPrefix("ZBLL"), order: OLL_GROUP_ORDER },

        // ZBLS：第一个词就是 LS / EO 家族（C、D、E、EO、G、H、I、Line…）。
        ZBLS: { keyOf: firstToken },

        // 1LLL / OLLCP：按对应的 OLL 编号分组。
        "1LLL": {
            keyOf: (name) => {
                const m = name.match(/^1LLL (\d+)/);
                return m ? `OLL ${m[1]}` : "";
            },
        },
        OLLCP: {
            keyOf: (name) => {
                const m = name.match(/^OLLCP(\d+)/);
                return m ? `OLL ${m[1]}` : "";
            },
        },

        // CMLL / OH CMLL：Anti Sune、H、L、O、Pi、Sune、T、U。
        CMLL: {
            keyOf: matchingPrefix(["Anti Sune", "H", "L", "O", "Pi", "Sune", "T", "U"]),
            order: ["Anti Sune", "H", "L", "O", "Pi", "Sune", "T", "U"],
        },
        "OH CMLL": {
            keyOf: matchingPrefix(["Antisune", "H", "L", "O", "Pi", "Sune", "T", "U"]),
            order: ["Antisune", "H", "L", "O", "Pi", "Sune", "T", "U"],
        },

        // ELL：4 Flip 与 BF/BL/BR/FL/FR/LB/LR/Pure/RF/RL 家族。
        ELL: {
            keyOf: matchingPrefix(["4 Flip", "BF", "BL", "BR", "FL", "FR", "LB", "LR", "Pure", "RF", "RL"]),
        },

        // CLS：按角块位置（FDR / FRU / RFD / RFU / UFR）分组。
        CLS: {
            keyOf: (name) => {
                const m = name.match(/^CLS ([A-Z]{3})/);
                return m ? m[1] : "";
            },
        },

        // SBLS：按第一个词（D、Dm、Dp、U、Um、Up）分组。
        SBLS: { keyOf: firstToken },

        // LSE-EOLR：去掉括号里的具体棱块位置，按「0 / 2」「Arrow」等状态分组。
        "LSE-EOLR": {
            keyOf: (name) => name.split(" (")[0].trim(),
        },
    },

    "2x2": {
        // CLL / EG / LEG-1：七个顶面方向。
        CLL: {
            keyOf: afterPrefix("CLL"),
            order: ["AS", "H", "L", "Pi", "Sune", "T", "U"],
        },
        EG1: { keyOf: afterPrefix("EG1"), order: OLL_GROUP_ORDER },
        EG2: { keyOf: afterPrefix("EG2"), order: OLL_GROUP_ORDER },
        LEG1: {
            keyOf: afterPrefix("LEG-1"),
            order: ["Anti-Sune", "H", "L", "Pi", "Sune", "T", "U"],
        },

        // TCLL / TEG2+：按形态（Gun、Hammer、Pinwheel…）分组。
        "TCLL+": { keyOf: afterPrefix("TCLL+") },
        "TCLL-": { keyOf: afterPrefix("TCLL-") },
        "TEG2+": { keyOf: afterPrefix("TEG2+") },

        // LS1…LS9：按每个套自己的子形态分组。
        LS1: { keyOf: afterPrefix("LS-1") },
        LS2: { keyOf: afterPrefix("LS-2") },
        LS3: { keyOf: afterPrefix("LS-3") },
        LS4: { keyOf: afterPrefix("LS-4") },
        LS5: { keyOf: afterPrefix("LS-5") },
        LS6: { keyOf: afterPrefix("LS-6") },
        LS7: { keyOf: afterPrefix("LS-7") },
        LS8: { keyOf: afterPrefix("LS-8") },
        LS9: { keyOf: afterPrefix("LS-9") },
        // PBL：Adj / Opp / PBL 三组。
        PBL: { keyOf: firstToken },
    },
};

// 返回 [{ key, cases }]；只有一个（或没有）家族时返回空数组，表示不需要分层。
export function getFormulaFamilies(puzzleKey, catKey, cases) {
    const rule = RULES[puzzleKey] && RULES[puzzleKey][catKey];
    if (!rule || !Array.isArray(cases) || cases.length < 2) return [];

    const families = collectFamilies(cases, rule.keyOf, rule.order);
    return families.length > 1 ? families : [];
}
