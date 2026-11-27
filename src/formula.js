// 公式库：模块/分类浏览、3D 演示、训练模式
import { normalizeCategories, groupCategories, HIDDEN_PUZZLES } from "./formulaSets.js";
import { getFormulaFamilies } from "./formulaFamilies.js";
import { getPuzzleMeta, getTwistyPuzzle, normalizeFormulaAlg } from "./algNotation.js";
import { applyAlgToFacelets, applyAlgToFaceletsForPuzzle, cubeThumbSVG, isTopLayerOnly, topFacePatternSVG } from "./cubeThumb.js";
import { sq1ThumbSVG, sq1OrientationSVG, sq1PiecesFromAlg } from "./sq1Thumb.js";
import { puzzleIconHTML } from "./puzzleIcons.js";
import { invertAlg } from "./algInverse.js";
import { decorateTwistyElement, loadTwisty } from "./twistyView.js";
import { loadLsllOneStepFamily, lsllOneStepFamilies, lsllOneStepTotal } from "./lsllLoader.js";

// LSLL 一步 / 两步的列表统一每页 50 条，翻页只替换列表内容。
const FORMULA_PAGE_SIZE = 50;

// 可以按「只有顶层未还原」自动切换到平面图的立方体项目。
// 二阶默认也适用，只有 PBL / EG 系列保持 3D；5x5 全部保持 3D。
const FLAT_CUBE_PUZZLES = ["2x2", "3x3", "4x4", "6x6", "7x7"];
const KEEP_3D_CATS = { "2x2": ["PBL", "EG"] };
function keepCategory3D(puzzleKey, catKey) {
    const list = KEEP_3D_CATS[puzzleKey] || [];
    const key = String(catKey || "");
    return list.some((prefix) => key === prefix || key.indexOf(prefix) === 0);
}

// 固定缩略图视角的分类：
// 桥式 CMLL 只看顶层角块，不需要看底层，统一画平面图；
// LSE 涉及中层/底层棱块，平面图会漏信息，统一画 3D。
const FORCE_FLAT_CATS = {
    "3x3": ["CMLL", "2-Look CMLL", "OH CMLL", "WV", "VLS", "SV"],
    "4x4": ["PLL Parity"],
};
const FORCE_3D_CATS = {
    "3x3": ["LSE-EOLR", "ZBLS", "F2L", "非标", "伪槽", "FRUF", "CLS"],
};

// 这些分类只看当前步骤的定向，不显示 PLL（最后一层位置）状态。
const STATE_STICKERING = {
    "3x3": {
        CLS: "CLS",
    },
    "2x2": {
        OLL: "OLL",
        PBL: "PBL",
        CLL: "OCLL",
        EG1: "OCLL",
        EG2: "OCLL",
        LEG1: "OCLL",
        "TCLL+": "OCLL",
        "TCLL-": "OCLL",
        "TEG2+": "OCLL",
        LS1: "OCLL",
        LS2: "OCLL",
        LS3: "OCLL",
        LS4: "OCLL",
        LS5: "OCLL",
        LS6: "OCLL",
        LS7: "OCLL",
        LS8: "OCLL",
        LS9: "OCLL",
    },
    "4x4": {
        "OLL Parity": "OLL",
    },
    "5x5": {
        L2C: "L2C",
    },
    "6x6": {
        L2C: "L2C",
    },
    "megaminx": {
        CO: "OCLL",
        CP: "CPLL",
        EO: "EOLL",
        EP: "EPLL",
        PLL: "PLL",
    },
};
function stateStickering(puzzleKey, catKey) {
    return (STATE_STICKERING[puzzleKey] || {})[catKey] || "";
}

// F2L / 非标 / 伪槽 / FRUF：已还原部分保持原样，只隐藏顶层的其他块。
// 需要入槽的 FR 角块 CORNERS[4] / 棱块 EDGES[8] 即使在顶层也保持显示。
const F2L_PAIR_MASK = {
    orbits: {
        CORNERS: {
            pieces: Array.from({ length: 8 }, (_, i) => ({
                facelets: Array(5).fill(i < 4 ? "ignored" : "regular"),
            })),
        },
        EDGES: {
            pieces: Array.from({ length: 12 }, (_, i) => ({
                facelets: Array(5).fill(i < 4 ? "ignored" : "regular"),
            })),
        },
        CENTERS: {
            pieces: Array.from({ length: 6 }, () => ({
                facelets: Array(5).fill("regular"),
            })),
        },
    },
};
function isF2LPairOnly(puzzleKey, catKey) {
    return puzzleKey === "3x3"
        && (catKey === "F2L" || catKey === "非标" || catKey === "伪槽" || catKey === "FRUF");
}

// SQ1 状态卡片改用自绘 3D：CS 只看形状，CO/EO/OBL 只看顶面朝向，
// 其余分类显示完整颜色。黑顶由外层 .sq1BlackTop 的 CSS 只覆盖顶面。
const SQ1_THUMB_SIZE = 96;
function sq1ThumbMode(catKey) {
    if (catKey === "CS") return "shape";
    if (catKey === "CO" || catKey === "EO" || catKey === "OBL") return "orientation";
    return "full";
}
function categoryViewMode(puzzleKey, catKey) {
    const key = String(catKey || "");
    if ((FORCE_FLAT_CATS[puzzleKey] || []).indexOf(key) !== -1) return "flat";
    if ((FORCE_3D_CATS[puzzleKey] || []).indexOf(key) !== -1) return "3d";
    return "";
}

// 家族卡片的特殊缩略图：
// - oll-state：只画对应的 OLL 状态（ZBLL / COLL / OLLCP / 1LLL）
// - top-yellow：只画顶面黄色状态（二阶 CLL / EG）
// - zbls-3d：3D 保留已还原部分原色，未还原区域只显示黄色/深灰（ZBLS）
const FAMILY_THUMB_MODES = {
    "3x3": {
        ZBLL: "oll-state",
        COLL: "oll-state",
        OLLCP: "oll-state",
        "1LLL": "oll-state",
        ZBLS: "zbls-3d",
    },
    "2x2": {
        CLL: "top-yellow",
        EG1: "top-yellow",
        EG2: "top-yellow",
    },
};
function familyThumbMode(puzzleKey, catKey) {
    return (FAMILY_THUMB_MODES[puzzleKey] || {})[catKey] || "";
}

// ZBLL / COLL 的 7 个家族对应的十字 OLL 编号。
const OCLL_BY_FAMILY = { AS: 26, H: 21, L: 25, Pi: 22, S: 27, T: 24, U: 23 };
let ollRowsByName = null;
function getOllRow(name) {
    if (!ollRowsByName) {
        ollRowsByName = new Map();
        const rows = (window.FormulaDB && window.FormulaDB["3x3"] && window.FormulaDB["3x3"]["OLL"]) || [];
        rows.forEach((row) => {
            if (row && row[0]) ollRowsByName.set(row[0], row);
        });
    }
    return ollRowsByName.get(name) || null;
}
function familyOllRow(puzzleKey, catKey, familyKey) {
    if (puzzleKey !== "3x3") return null;
    let number = 0;
    if (catKey === "ZBLL" || catKey === "COLL") {
        number = OCLL_BY_FAMILY[familyKey] || 0;
    } else if (catKey === "OLLCP" || catKey === "1LLL") {
        const match = String(familyKey).match(/^OLL (\d+)$/);
        number = match ? Number(match[1]) : 0;
    }
    return number ? getOllRow(`OLL ${number}`) : null;
}

// OLL / OLL Parity 的状态卡片只看黄色贴纸（顶面 + 侧面标签），不需要其他颜色。
const YELLOW_ONLY_CATS = {
    "3x3": ["OLL"],
    "2x2": ["OLL", "CLL", "EG1", "EG2"],
    "4x4": ["OLL Parity"],
};
function yellowOnlyCategory(puzzleKey, catKey) {
    return (YELLOW_ONLY_CATS[puzzleKey] || []).indexOf(String(catKey || "")) !== -1;
}

// 所有 3D 缩略图统一使用这个尺寸，避免 2x2 / 3x3 / 4x4 之间大小不一致。
const THUMB_3D_SIZE = 64;
const CUBE_ORDER = { "2x2": 2, "3x3": 3, "4x4": 4, "5x5": 5, "6x6": 6, "7x7": 7 };

// 状态卡片数量可能很大（取消分页后一次展示全部）。缩略图改为进入视口前再创建，
// 避免一次创建成百上千个 twisty-player 或平面 SVG。
let cardThumbObserver = null;
function lazyMountThumb(el, mount) {
    if (typeof IntersectionObserver === "undefined") {
        mount();
        return;
    }
    if (!cardThumbObserver) {
        cardThumbObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const fn = entry.target._mountThumb;
                if (fn) fn();
                cardThumbObserver.unobserve(entry.target);
            });
        }, { rootMargin: "400px 0px" });
    }
    el._mountThumb = () => {
        el._mountThumb = null;
        mount();
    };
    cardThumbObserver.observe(el);
}

// 由 buildFormulaUI 注册：两步列表里点击 ZBLL 名称时跳到 ZB 分类查看公式。
let zbllJumpHandler = null;

// 平面图每格 10px；3D 立方体投影色块边长 9px。
function lsllStateThumbSVG(facelets, flatSize = 50, cubeSize = 54) {
    return cubeThumbSVG(facelets, isTopLayerOnly(facelets) ? flatSize : cubeSize);
}

function buildFormulaUI() {
    const container = document.getElementById("dynamicFormulaUI");
    while (container.firstChild) container.removeChild(container.firstChild);

    const db = window.FormulaDB;
    if (!db || !Object.keys(db).length) {
        const err = document.createElement("div");
        err.style = "color:#c82423; padding:20px; text-align:center; font-weight:bold;";
        err.textContent = "⚠️ 外部数据未加载";
        const retry = document.createElement("button");
        retry.textContent = "点击重试";
        retry.style = "padding:10px 20px;font-size:16px;margin-top:10px;display:block;margin-left:auto;margin-right:auto;";
        retry.onclick = () => location.reload();
        container.appendChild(err);
        container.appendChild(retry);
        return;
    }

    const contentArea = document.createElement("div");
    const puzzleKeys = Object.keys(db)
        .filter((puzzleKey) => HIDDEN_PUZZLES.indexOf(puzzleKey) === -1);
    const modules = new Map();

    // 顶部只展示当前项目（图标 + 名称），点开后用卡片切换其他项目公式库。
    const pickerBtn = document.getElementById("formulaLibraryBtn");
    const pickerIcon = document.getElementById("formulaLibraryIcon");
    const pickerName = document.getElementById("formulaLibraryName");
    const libraryModal = document.getElementById("formulaLibraryModal");
    const libraryGrid = document.getElementById("formulaLibraryGrid");
    const libraryCloseBtn = document.getElementById("closeFormulaLibraryBtn");

    const closeLibraryModal = () => {
        if (!libraryModal) return;
        libraryModal.classList.remove("show");
        if (pickerBtn) pickerBtn.setAttribute("aria-expanded", "false");
    };

    const openLibraryModal = () => {
        if (!libraryModal) return;
        libraryModal.classList.add("show");
        if (pickerBtn) pickerBtn.setAttribute("aria-expanded", "true");
        const active = libraryGrid && libraryGrid.querySelector(".formulaLibraryOption.active");
        if (active) active.scrollIntoView({ block: "nearest" });
    };

    const syncPicker = (puzzleKey) => {
        const meta = getPuzzleMeta(puzzleKey);
        if (pickerIcon) pickerIcon.innerHTML = puzzleIconHTML(puzzleKey, 30);
        if (pickerName) pickerName.textContent = meta.short;
        if (pickerBtn) pickerBtn.setAttribute("aria-label", `当前公式库：${meta.short}，点击切换`);
        if (libraryGrid) {
            Array.from(libraryGrid.querySelectorAll(".formulaLibraryOption")).forEach((btn) => {
                const isActive = btn.dataset.puzzle === puzzleKey;
                btn.classList.toggle("active", isActive);
                btn.setAttribute("aria-checked", String(isActive));
            });
        }
    };

    const activatePuzzle = (puzzleKey) => {
        const entry = modules.get(puzzleKey);
        if (!entry) return;
        modules.forEach((mod, key) => {
            mod.div.style.display = key === puzzleKey ? "block" : "none";
        });
        entry.showGroup(entry.activeGroup);
        syncPicker(puzzleKey);
    };

    if (libraryGrid) {
        while (libraryGrid.firstChild) libraryGrid.removeChild(libraryGrid.firstChild);
        puzzleKeys.forEach((puzzleKey) => {
            const meta = getPuzzleMeta(puzzleKey);
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "formulaLibraryOption";
            opt.dataset.puzzle = puzzleKey;
            opt.setAttribute("role", "menuitemradio");
            opt.setAttribute("aria-checked", "false");

            const icon = document.createElement("span");
            icon.className = "formulaLibraryOptionIcon";
            icon.innerHTML = puzzleIconHTML(puzzleKey, 46);
            const label = document.createElement("span");
            label.className = "formulaLibraryOptionName";
            label.textContent = meta.short;

            opt.appendChild(icon);
            opt.appendChild(label);
            opt.onclick = () => {
                closeLibraryModal();
                activatePuzzle(puzzleKey);
            };
            libraryGrid.appendChild(opt);
        });
    }

    if (pickerBtn) pickerBtn.onclick = openLibraryModal;
    if (libraryCloseBtn) libraryCloseBtn.onclick = closeLibraryModal;
    if (libraryModal) {
        libraryModal.onclick = (e) => {
            if (e.target === libraryModal) closeLibraryModal();
        };
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && libraryModal.classList.contains("show")) closeLibraryModal();
        });
    }

    puzzleKeys.forEach((puzzleKey) => {
        const puzzleData = normalizeCategories(puzzleKey, db[puzzleKey]);
        const groups = groupCategories(puzzleKey, puzzleData);
        const puzzleDiv = document.createElement("div");
        puzzleDiv.style.display = "none";

        const groupTab = document.createElement("div");
        groupTab.className = "groupTab";
        const subTab = document.createElement("div");
        subTab.className = "subTab";
        const subContentWrap = document.createElement("div");
        const puzzleType = getTwistyPuzzle(puzzleKey);

        const listMap = {};
        const catCounts = {};
        let activeGroup = 0;

        // 所有分类容器先建好，切换时只改显示并按需渲染
        puzzleData.forEach((cat) => {
            const oneStepTotal = cat.key === "LSLL 一步" ? lsllOneStepTotal() : 0;
            catCounts[cat.key] = oneStepTotal || cat.cases.length;
            const listDiv = document.createElement("div");
            listDiv.style.display = "none";

            // 懒渲染：切到该分类时才生成列表（1LLL 有 3000+ 条）
            const ensureRendered = () => {
                if (listDiv.dataset.rendered === "1") return;
                const api = renderFormulaList(cat.cases, listDiv, puzzleKey, puzzleType, cat.key);
                listMap[cat.key].api = api;
                listDiv.dataset.rendered = "1";
            };

            listMap[cat.key] = { div: listDiv, ensure: ensureRendered };
            subContentWrap.appendChild(listDiv);
        });

        const showCategory = (catKey) => {
            Object.keys(listMap).forEach((key) => {
                listMap[key].div.style.display = key === catKey ? "block" : "none";
            });
            Array.from(subTab.children).forEach((btn) => {
                btn.classList.toggle("active", btn.dataset.cat === catKey);
            });
            const entry = listMap[catKey];
            if (entry) {
                entry.ensure();
                // 家族视图每次从分类入口进入都回到家族网格，避免停留在上次点开的家族里。
                if (entry.api && typeof entry.api.reset === "function") entry.api.reset();
            }
        };

        const showGroup = (groupIdx) => {
            const group = groups[groupIdx];
            if (!group) return;
            activeGroup = groupIdx;

            Array.from(groupTab.children).forEach((btn, i) => {
                btn.classList.toggle("active", i === groupIdx);
            });

            // 分类按钮随当前大类重建
            while (subTab.firstChild) subTab.removeChild(subTab.firstChild);
            group.cats.forEach((catKey) => {
                const subBtn = document.createElement("button");
                subBtn.type = "button";
                subBtn.appendChild(document.createTextNode(catKey));
                const countEl = document.createElement("span");
                countEl.className = "catCount";
                countEl.textContent = (Number(catCounts[catKey]) || 0).toLocaleString();
                subBtn.appendChild(countEl);
                subBtn.dataset.cat = catKey;
                subBtn.onclick = () => showCategory(catKey);
                subTab.appendChild(subBtn);
            });

            showCategory(group.cats[0]);
        };

        // 从两步 LSLL 流程跳到 ZB 分类里的具体公式行：切模块、切大类、切分类，
        // 再滚动到对应 case 并短暂高亮，不重新打开页面。
        const jumpToCase = (catKey, caseName) => {
            activatePuzzle(puzzleKey);
            let groupIdx = groups.findIndex((group) => group.cats.indexOf(catKey) !== -1);
            if (groupIdx < 0) groupIdx = 0;
            showGroup(groupIdx);
            showCategory(catKey);

            // 新的状态列表会直接打开该 case 的公式详情；旧列表则退回滚动高亮。
            const entry = listMap[catKey];
            if (entry && entry.api && typeof entry.api.openCase === "function") {
                if (entry.api.openCase(caseName)) return;
            }

            requestAnimationFrame(() => requestAnimationFrame(() => {
                const list = listMap[catKey] && listMap[catKey].div;
                if (!list) return;
                const target = Array.from(list.querySelectorAll(".formulaItem"))
                    .find((item) => item.dataset.caseName === caseName);
                if (!target) return;
                target.classList.add("formulaHighlight");
                target.scrollIntoView({ block: "center", behavior: "smooth" });
                setTimeout(() => target.classList.remove("formulaHighlight"), 2600);
            }));
        };
        if (puzzleKey === "3x3") {
            zbllJumpHandler = (catKey, caseName) => jumpToCase(catKey, caseName);
        }

        groups.forEach((group, groupIdx) => {
            const groupBtn = document.createElement("button");
            groupBtn.type = "button";
            groupBtn.textContent = group.name;
            groupBtn.onclick = () => showGroup(groupIdx);
            groupTab.appendChild(groupBtn);
        });

        if (puzzleKey === "sq1") {
            const topBar = document.createElement("div");
            topBar.className = "sq1TopBar";
            const topBtn = document.createElement("button");
            topBtn.type = "button";
            topBtn.className = "sq1TopBtn";
            let blackTop = false;
            const syncTop = () => {
                topBtn.textContent = blackTop ? "顶面：黑" : "顶面：黄";
                puzzleDiv.classList.toggle("sq1BlackTop", blackTop);
            };
            topBtn.onclick = () => {
                blackTop = !blackTop;
                syncTop();
            };
            syncTop();
            topBar.appendChild(topBtn);
            puzzleDiv.appendChild(topBar);
        }

        puzzleDiv.appendChild(groupTab);
        puzzleDiv.appendChild(subTab);
        puzzleDiv.appendChild(subContentWrap);

        modules.set(puzzleKey, {
            div: puzzleDiv,
            showGroup,
            get activeGroup() {
                return activeGroup;
            },
        });
        contentArea.appendChild(puzzleDiv);
    });

    container.appendChild(contentArea);

    // 默认展示第一个项目（数据顺序为三阶 → 二阶 → …）
    if (puzzleKeys.length) activatePuzzle(puzzleKeys[0]);
}

// LSLL 的 case 名带 CubeRoot 的大类字母（如 A+ / S / F），列表里按大类插一条分组标题，
// 方便对照 CubeRoot 的 41 个已列大类。其他分类不显示标题。
function lsllFamilyLabel(catKey, name) {
    if (catKey.indexOf("LSLL") !== 0) return "";
    const m = name.match(/^(ZBLS|LSLL) ([A-Z][+-]?|S|T|F) /);
    if (m) return `${m[1]} · ${m[2]}`;
    if (name.indexOf("ZBLL ") === 0) return "ZBLL · 第二眼";
    if (name.indexOf("PLL ") === 0) return "PLL · 第二眼";
    return "";
}

function renderLsllOneStep(raw, containerDiv, puzzleKey, puzzleType) {
    const families = lsllOneStepFamilies();

    // 兼容没有 family 元数据的数据文件：退回一次性渲染。
    if (!families.length) {
        renderFormulaRows(raw, containerDiv, puzzleKey, puzzleType);
        return;
    }

    const showGrid = (scroll = false) => {
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const intro = document.createElement("div");
        intro.className = "lsllFamilyIntro";
        const introTitle = document.createElement("b");
        introTitle.textContent = "LSLL 一步";
        const introNote = document.createElement("span");
        introNote.textContent = `按大类选择 LS 状态 · ${families.length} 类 / ${lsllOneStepTotal(families).toLocaleString()} 条`;
        intro.appendChild(introTitle);
        intro.appendChild(introNote);

        const grid = document.createElement("div");
        grid.className = "lsllFamilyGrid";
        families.forEach((family) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "lsllFamilyCard";
            card.title = `查看 LSLL ${family.key} 的公式`;

            const thumb = document.createElement("span");
            thumb.className = "lsllFamilyThumb";
            thumb.innerHTML = cubeThumbSVG(family.facelets, 54);
            const name = document.createElement("span");
            name.className = "lsllFamilyName";
            name.textContent = family.key;
            const count = document.createElement("span");
            count.className = "lsllFamilyCount";
            count.textContent = `${family.count.toLocaleString()} 条`;

            card.appendChild(thumb);
            card.appendChild(name);
            card.appendChild(count);
            card.onclick = () => showCases(family);
            grid.appendChild(card);
        });

        containerDiv.appendChild(intro);
        containerDiv.appendChild(grid);
        if (scroll) requestAnimationFrame(() => intro.scrollIntoView({ block: "start" }));
    };

    const showCases = async (family) => {
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const bar = document.createElement("div");
        bar.className = "lsllFamilyBar";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "lsllBackBtn";
        back.textContent = "← 返回大类";
        back.onclick = () => showGrid(true);
        const title = document.createElement("span");
        title.className = "lsllFamilyTitle";
        title.textContent = `LSLL ${family.key}`;
        bar.appendChild(back);
        bar.appendChild(title);
        containerDiv.appendChild(bar);

        const note = document.createElement("div");
        note.className = "lsllFamilyNote";
        note.textContent = `该大类共 ${family.count.toLocaleString()} 条一步公式；每页 ${FORMULA_PAGE_SIZE} 个状态，点击状态查看公式。`;
        containerDiv.appendChild(note);

        const listDiv = document.createElement("div");
        containerDiv.appendChild(listDiv);
        const loading = document.createElement("div");
        loading.className = "lsllFamilyNote";
        loading.textContent = `正在加载 LSLL ${family.key} 公式…`;
        listDiv.appendChild(loading);

        try {
            const cases = await loadLsllOneStepFamily(family);
            if (!listDiv.isConnected) return; // 用户已经返回大类网格
            while (listDiv.firstChild) listDiv.removeChild(listDiv.firstChild);
            renderCaseStateList(cases, listDiv, puzzleKey, puzzleType, "LSLL 一步");
        } catch (err) {
            if (listDiv.isConnected) loading.textContent = "⚠️ 公式加载失败，请刷新页面重试";
        }
        requestAnimationFrame(() => bar.scrollIntoView({ block: "start" }));
    };

    showGrid();
}

// 两步 LSLL：LS 状态大类 → ZBLS 状态 → ZBLL/PLL 名称。
// 前两层只展示状态/名称，不展开公式；第二层名称再跳到对应分类查看公式。
function renderLsllTwoStep(raw, containerDiv, puzzleKey, puzzleType) {
    const families = lsllOneStepFamilies();
    const zblsByFamily = {};
    const zbllRows = [];
    raw.forEach((row) => {
        const [name] = row;
        const match = name.match(/^ZBLS (\S+) (.+)$/);
        if (match) {
            if (!zblsByFamily[match[1]]) zblsByFamily[match[1]] = [];
            zblsByFamily[match[1]].push({ name, caseName: match[2], alg: row[1] });
        } else if (name.indexOf("ZBLL ") === 0 || name.indexOf("PLL ") === 0) {
            zbllRows.push(row);
        }
    });

    // 没有大类元数据时退回平铺列表，至少保持每页 50 条的分页。
    if (!families.length) {
        renderFormulaRows(raw, containerDiv, puzzleKey, puzzleType, "LSLL 两步", { pageSize: FORMULA_PAGE_SIZE });
        return;
    }

    const zblsTotal = Object.keys(zblsByFamily)
        .reduce((sum, key) => sum + zblsByFamily[key].length, 0);

    const showLsGrid = (scroll = false) => {
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const intro = document.createElement("div");
        intro.className = "lsllFamilyIntro";
        const introTitle = document.createElement("b");
        introTitle.textContent = "LSLL 两步 · LS 状态";
        const introNote = document.createElement("span");
        introNote.textContent = `先选 LS 状态 · ${families.length} 类 / ${zblsTotal} 个 ZBLS`;
        intro.appendChild(introTitle);
        intro.appendChild(introNote);

        const grid = document.createElement("div");
        grid.className = "lsllFamilyGrid";
        families.forEach((family) => {
            const states = zblsByFamily[family.key] || [];
            const card = document.createElement("button");
            card.type = "button";
            card.className = "lsllFamilyCard";
            card.title = `查看 LS ${family.key} 的 ZBLS 状态`;

            const thumb = document.createElement("span");
            thumb.className = "lsllFamilyThumb";
            thumb.innerHTML = cubeThumbSVG(family.facelets, 54);
            const name = document.createElement("span");
            name.className = "lsllFamilyName";
            name.textContent = family.key;
            const count = document.createElement("span");
            count.className = "lsllFamilyCount";
            count.textContent = `${states.length} 个 ZBLS`;

            card.appendChild(thumb);
            card.appendChild(name);
            card.appendChild(count);
            card.onclick = () => showZblsStates(family, states);
            grid.appendChild(card);
        });

        containerDiv.appendChild(intro);
        containerDiv.appendChild(grid);
        if (scroll) requestAnimationFrame(() => intro.scrollIntoView({ block: "start" }));
    };

    const showZblsStates = (family, states) => {
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const bar = document.createElement("div");
        bar.className = "lsllFamilyBar";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "lsllBackBtn";
        back.textContent = "← 返回 LS 状态";
        back.onclick = () => showLsGrid(true);
        const title = document.createElement("span");
        title.className = "lsllFamilyTitle";
        title.textContent = `LS ${family.key} · ZBLS`;
        bar.appendChild(back);
        bar.appendChild(title);
        containerDiv.appendChild(bar);

        const note = document.createElement("div");
        note.className = "lsllFamilyNote";
        note.textContent = "这里只显示 ZBLS 状态和名称，不展开公式；点击状态继续查看 ZBLL/PLL。";
        containerDiv.appendChild(note);

        const grid = document.createElement("div");
        grid.className = "lsllCaseGrid";
        states.forEach((state) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "lsllCaseCard";
            card.title = `查看 ${state.name} 之后的 ZBLL/PLL`;

            const thumb = document.createElement("span");
            thumb.className = "lsllCaseThumb";
            const displayAlg = normalizeFormulaAlg(puzzleKey, state.alg);
            const stateFacelets = displayAlg ? applyAlgToFacelets(invertAlg(displayAlg)) : "";
            thumb.innerHTML = lsllStateThumbSVG(stateFacelets || family.facelets);
            const main = document.createElement("span");
            main.className = "lsllCaseMain";
            main.textContent = state.caseName;
            const sub = document.createElement("span");
            sub.className = "lsllCaseSub";
            sub.textContent = state.name;

            card.appendChild(thumb);
            card.appendChild(main);
            card.appendChild(sub);
            card.onclick = () => showZbllList(family, state);
            grid.appendChild(card);
        });

        containerDiv.appendChild(grid);
        requestAnimationFrame(() => bar.scrollIntoView({ block: "start" }));
    };

    const showZbllList = (family, state) => {
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const bar = document.createElement("div");
        bar.className = "lsllFamilyBar";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "lsllBackBtn";
        back.textContent = "← 返回 ZBLS";
        const states = zblsByFamily[family.key] || [];
        back.onclick = () => showZblsStates(family, states);
        const title = document.createElement("span");
        title.className = "lsllFamilyTitle";
        title.textContent = `${state.name} → ZBLL/PLL`;
        bar.appendChild(back);
        bar.appendChild(title);
        containerDiv.appendChild(bar);

        const available = zbllCategoryNames();
        const missingCount = zbllRows.filter(([name]) => !available.has(name)).length;

        const note = document.createElement("div");
        note.className = "lsllFamilyNote";
        note.textContent = "ZBLS 之后可能接到任意 ZBLL/PLL。仅顶面 case 使用平面图，其余折成 3D；点击名称跳到 ZB / PLL 分类查看公式。"
            + (missingCount ? `（${missingCount} 个 case 在公式库暂无公式，已标灰）` : "");
        containerDiv.appendChild(note);

        const listDiv = document.createElement("div");
        containerDiv.appendChild(listDiv);
        renderPagedButtons(zbllRows, listDiv, {
            gridClass: "zbllNameGrid",
            pageSize: FORMULA_PAGE_SIZE,
            unit: "个 ZBLL/PLL",
            renderItem: ([name, alg]) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "zbllNameBtn";
                const thumb = document.createElement("span");
                thumb.className = "zbllNameThumb";
                const displayAlg = normalizeFormulaAlg(puzzleKey, alg);
                const stateFacelets = displayAlg ? applyAlgToFacelets(invertAlg(displayAlg)) : "";
                if (stateFacelets) thumb.innerHTML = lsllStateThumbSVG(stateFacelets);
                const label = document.createElement("span");
                label.className = "zbllNameText";
                label.textContent = name;
                btn.appendChild(thumb);
                btn.appendChild(label);
                if (available.has(name)) {
                    const target = available.get(name);
                    btn.title = `跳到 ${target.catKey === "PLL" ? "PLL" : "ZB · ZBLL"} 查看公式`;
                    btn.onclick = () => jumpToZbFormula(target.catKey, target.caseName);
                } else {
                    btn.disabled = true;
                    btn.classList.add("zbllNameMissing");
                    btn.title = "公式库暂无该 case 的公式";
                }
                return btn;
            },
        });
        requestAnimationFrame(() => bar.scrollIntoView({ block: "start" }));
    };

    showLsGrid();
}

function jumpToZbFormula(catKey, caseName) {
    if (zbllJumpHandler) zbllJumpHandler(catKey, caseName);
}

// ZB / PLL 分类里实际可跳转的第二层 case（两步名称 → 分类 + 分类内 case 名）。
// 两步数据里的第二层公式来自 CubeRoot 的 ZBLL + PLL 两个集合；
// ZBLL 分类名称自带前缀，PLL 分类名称不带，因此这里统一成两步数据里的写法。
function zbllCategoryNames() {
    const db = window.FormulaDB;
    const map = new Map();
    const add = (catKey, prefix) => {
        const rows = db && db["3x3"] && db["3x3"][catKey];
        (Array.isArray(rows) ? rows : []).forEach(([name]) => {
            map.set(prefix + name, { catKey, caseName: name });
        });
    };
    add("ZBLL", "");
    add("PLL", "PLL ");
    return map;
}

// 通用分页条：首页 / 上一页 / 页码信息 / 下一页 / 末页。
function buildPager(page, totalPages, total, onChange, unit = "条") {
    const wrap = document.createElement("div");
    wrap.className = "formulaPager";

    const addBtn = (label, target, disabled) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "formulaPageBtn";
        btn.textContent = label;
        btn.disabled = disabled;
        if (!disabled) btn.onclick = () => onChange(target);
        wrap.appendChild(btn);
    };

    addBtn("« 首页", 1, page === 1);
    addBtn("‹ 上一页", page - 1, page === 1);

    const info = document.createElement("span");
    info.className = "formulaPageInfo";
    info.textContent = `第 ${page} / ${totalPages} 页 · 共 ${total.toLocaleString()} ${unit}`;
    wrap.appendChild(info);

    addBtn("下一页 ›", page + 1, page === totalPages);
    addBtn("末页 »", totalPages, page === totalPages);
    return wrap;
}

// 按页渲染一组按钮/卡片；翻页时只替换网格内容，不跳转页面。
function renderPagedButtons(items, containerDiv, options) {
    const pageSize = Number(options.pageSize) || FORMULA_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    let page = 1;

    const grid = document.createElement("div");
    grid.className = options.gridClass || "";
    const footer = document.createElement("div");
    footer.className = "formulaPagerWrap";
    containerDiv.appendChild(grid);
    containerDiv.appendChild(footer);

    const draw = (targetPage, scroll) => {
        page = Math.min(Math.max(1, targetPage), totalPages);
        while (grid.firstChild) grid.removeChild(grid.firstChild);

        const start = (page - 1) * pageSize;
        items.slice(start, start + pageSize).forEach((item, i) => {
            grid.appendChild(options.renderItem(item, start + i));
        });

        while (footer.firstChild) footer.removeChild(footer.firstChild);
        if (totalPages > 1) {
            footer.appendChild(buildPager(page, totalPages, items.length, (next) => draw(next, true), options.unit));
        }
        if (scroll) requestAnimationFrame(() => grid.scrollIntoView({ block: "start", behavior: "smooth" }));
    };

    draw(1, false);
}

// cubing.js 的 stickering 预设会把无关块统一设为 dim。这里把 dim 恢复成 regular，
// 已还原部分保持原色；预设里 ignored / ignoreNonPrimary 的部分仍然不显示。
function keepSolvedStickers(player) {
    const scene = player.experimentalModel && player.experimentalModel.twistySceneModel;
    if (!scene || !scene.stickeringMask) return;
    scene.stickeringMask.get().then((mask) => {
        const fixed = JSON.parse(JSON.stringify(mask));
        Object.keys(fixed.orbits || {}).forEach((orbitKey) => {
            const pieces = fixed.orbits[orbitKey].pieces || [];
            pieces.forEach((piece) => {
                piece.facelets = (piece.facelets || []).map((mode) => (
                    mode === "dim" ? "regular" : mode
                ));
            });
        });
        player.experimentalStickeringMaskOrbits = fixed;
    }).catch(() => {});
}

function makeTwistyPlayer(puzzleType, setup, alg, options = {}) {
    const player = document.createElement("twisty-player");
    player.setAttribute("puzzle", puzzleType);
    if (options.visualization) player.setAttribute("visualization", options.visualization);
    if (options.stickering) player.setAttribute("experimental-stickering", options.stickering);
    if (options.mask) player.experimentalStickeringMaskOrbits = options.mask;
    if (setup) player.setAttribute("experimental-setup-alg", setup);
    if (alg) player.setAttribute("alg", alg);
    player.setAttribute("control-panel", options.controlPanel || "none");
    player.setAttribute("background", "none");
    player.setAttribute("hint-facelets", "none");
    player.setAttribute("autoplay", "false");
    decorateTwistyElement(player, {
        puzzle: puzzleType,
        alg: alg || setup || "",
        label: "公式状态平面图",
    });
    return player;
}

// 通用「单分类状态」列表：先用 2D 状态卡片展示每个 case，点卡片再看公式。
// options.paginate 默认沿用旧规则（只有 LSLL 分页）；options.header 用于家族视图的返回栏。
function renderCaseGrid(raw, containerDiv, puzzleKey, puzzleType, catKey, options = {}) {
    // 只有 LSLL 一步 / 两步保留分页；其他分类一次性展示全部状态。
    const paginate = options.paginate !== undefined
        ? options.paginate
        : String(catKey || "").indexOf("LSLL") === 0;
    const pageSize = paginate ? FORMULA_PAGE_SIZE : Math.max(1, raw.length);
    const totalPages = paginate ? Math.max(1, Math.ceil(raw.length / pageSize)) : 1;
    let page = 1;

    const createCard = (row) => {
        const [name, alg] = row;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "caseStateCard";
        card.dataset.caseName = name;
        card.title = `查看 ${name} 的公式`;
        const useLsllThumb = puzzleKey === "3x3" && String(catKey || "").indexOf("LSLL") === 0;
        const viewMode = categoryViewMode(puzzleKey, catKey);
        const yellowOnly = yellowOnlyCategory(puzzleKey, catKey);
        const pairOnly = isF2LPairOnly(puzzleKey, catKey);
        const stickering = stateStickering(puzzleKey, catKey);
        if (useLsllThumb) card.classList.add("lsllStateCard");

        const thumb = document.createElement("span");
        thumb.className = "caseStateThumb";
        if (useLsllThumb) thumb.classList.add("lsllStateThumb");
        const displayAlg = normalizeFormulaAlg(puzzleKey, alg);
        const cubeOrder = CUBE_ORDER[puzzleKey];
        const useCubeFrame = Boolean(cubeOrder) && !useLsllThumb;
        if (useCubeFrame) thumb.style.height = `${THUMB_3D_SIZE}px`;
        if (useLsllThumb) {
            const stateFacelets = displayAlg ? applyAlgToFacelets(invertAlg(displayAlg)) : "";
            if (stateFacelets) {
                thumb.innerHTML = lsllStateThumbSVG(stateFacelets);
            } else {
                thumb.textContent = "状态";
                thumb.classList.add("caseStateThumbEmpty");
            }
        } else if (puzzleKey === "sq1" && displayAlg) {
            lazyMountThumb(thumb, async () => {
                try {
                    const setup = normalizeFormulaAlg("sq1", invertAlg(displayAlg));
                    const pieces = await sq1PiecesFromAlg(setup);
                    const sq1Mode = sq1ThumbMode(catKey);
                    if (sq1Mode === "orientation") {
                        // CO / EO / OBL：上下层分开的平面黑白图，不再受「顶面：黑」影响。
                        thumb.innerHTML = sq1OrientationSVG(pieces, 170, {
                            showEdges: catKey !== "CO",
                        });
                        thumb.classList.add("sq1FlatThumbWrap");
                    } else {
                        thumb.innerHTML = sq1ThumbSVG(pieces, SQ1_THUMB_SIZE, {
                            mode: sq1Mode,
                        });
                    }
                } catch (err) {
                    thumb.textContent = "状态";
                    thumb.classList.add("caseStateThumbEmpty");
                }
            });
        } else if (displayAlg) {
            lazyMountThumb(thumb, () => {
                const stateFacelets = applyAlgToFaceletsForPuzzle(puzzleKey, invertAlg(displayAlg));
                const thumbSide = () => {
                    const order = Math.round(Math.sqrt(stateFacelets.length / 6));
                    return (order + 2) * 10;
                };
                const drawFlat = () => {
                    // 每格固定 10px；4x4 / 6x6 等按项目阶数一一对应，整体尺寸随阶数增加。
                    const flatSize = thumbSide();
                    // 空白框缩到平面图实际高度。
                    if (useCubeFrame) thumb.style.height = `${flatSize}px`;
                    thumb.innerHTML = cubeThumbSVG(stateFacelets, flatSize, { forceFlat: true });
                };
                const addZblsOBadge = () => {
                    if (card.querySelector(".caseStateBadge")) return;
                    const badge = document.createElement("span");
                    badge.className = "caseStateBadge";
                    badge.textContent = "O";
                    badge.title = "CubeRoot ZBLS O 组：最后一组已入槽，只剩顶层";
                    card.appendChild(badge);
                };

                // OLL / OLL Parity 只看顶面黄色块。
                if (yellowOnly && stateFacelets) {
                    const flatSize = thumbSide();
                    if (useCubeFrame) thumb.style.height = `${flatSize}px`;
                    thumb.innerHTML = topFacePatternSVG(stateFacelets, flatSize, {
                        label: puzzleKey === "2x2" ? "顶面状态" : "OLL 状态",
                    });
                    return;
                }

                // 三阶 ZBLS 固定 3D；O 组（最后一组已入槽）额外标 O。
                if (puzzleKey === "3x3" && catKey === "ZBLS" && stateFacelets && isTopLayerOnly(stateFacelets)) {
                    addZblsOBadge();
                }

                // CMLL 系列固定平面图：只关心顶层，不看底层。
                if (viewMode === "flat" && stateFacelets) {
                    drawFlat();
                    return;
                }

                // 2x2 / 3x3 / 4x4 / 6x6 / 7x7：只有顶层未还原时用平面图；PBL / EG、5x5 保持 3D。
                // LSE、ZBLS 固定 3D，避免平面图漏掉中层/最后一组的信息。
                if (viewMode !== "3d"
                    && FLAT_CUBE_PUZZLES.indexOf(puzzleKey) !== -1
                    && !keepCategory3D(puzzleKey, catKey)
                    && stateFacelets
                    && isTopLayerOnly(stateFacelets)) {
                    drawFlat();
                    return;
                }
                try {
                    const visualization = puzzleKey === "skewb" ? "2D" : "3D";
                    const player = makeTwistyPlayer(puzzleType, invertAlg(displayAlg), "", {
                        visualization,
                        stickering,
                        mask: pairOnly ? F2L_PAIR_MASK : null,
                    });
                    player.className = "caseStatePlayer";
                    player.style.width = `${THUMB_3D_SIZE}px`;
                    player.style.height = `${THUMB_3D_SIZE}px`;
                    thumb.style.height = `${THUMB_3D_SIZE}px`;
                    thumb.appendChild(player);
                    if (stickering) keepSolvedStickers(player);
                } catch (err) {
                    thumb.textContent = "状态";
                    thumb.classList.add("caseStateThumbEmpty");
                }
            });
        } else {
            thumb.textContent = "状态";
            thumb.classList.add("caseStateThumbEmpty");
        }

        const nameEl = document.createElement("span");
        nameEl.className = "caseStateName";
        nameEl.textContent = name;

        card.appendChild(thumb);
        card.appendChild(nameEl);
        card.onclick = () => openDetail(row);
        return card;
    };

    const openDetail = (row) => {
        const [name, alg] = row;
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const bar = document.createElement("div");
        bar.className = "lsllFamilyBar";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "lsllBackBtn";
        back.textContent = "← 返回状态列表";
        back.onclick = () => drawGrid(page, true);
        const title = document.createElement("span");
        title.className = "lsllFamilyTitle";
        title.textContent = name;
        bar.appendChild(back);
        bar.appendChild(title);
        containerDiv.appendChild(bar);

        const detail = document.createElement("div");
        detail.className = "formulaDetail";
        detail.dataset.open = "true";

        const label = document.createElement("div");
        label.className = "formulaDetailLabel";
        label.textContent = "公式";
        const algEl = document.createElement("div");
        algEl.className = "formulaDetailAlg";
        algEl.textContent = alg;

        const viewer = document.createElement("div");
        viewer.className = "formulaDetailViewer";
        const displayAlg = normalizeFormulaAlg(puzzleKey, alg);
        if (displayAlg) {
            try {
                const player = makeTwistyPlayer(puzzleType, invertAlg(displayAlg), displayAlg, { controlPanel: "bottom-row" });
                player.className = "formulaDetailPlayer";
                viewer.appendChild(player);
                watchPlayerForErrors(player, viewer, detail);
            } catch (err) {
                viewer.textContent = "⚠️ 当前环境不支持3D渲染";
            }
        }

        detail.appendChild(label);
        detail.appendChild(algEl);
        detail.appendChild(viewer);
        containerDiv.appendChild(detail);
        requestAnimationFrame(() => bar.scrollIntoView({ block: "start" }));
    };

    const drawGrid = (targetPage = page, scroll = false) => {
        page = Math.min(Math.max(1, targetPage), totalPages);
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        if (options.header) {
            const bar = document.createElement("div");
            bar.className = "lsllFamilyBar";
            const back = document.createElement("button");
            back.type = "button";
            back.className = "lsllBackBtn";
            back.textContent = options.header.backLabel || "← 返回分类";
            back.onclick = options.header.onBack;
            const title = document.createElement("span");
            title.className = "lsllFamilyTitle";
            title.textContent = options.header.title;
            bar.appendChild(back);
            bar.appendChild(title);
            containerDiv.appendChild(bar);
        }

        const intro = document.createElement("div");
        intro.className = "caseStateIntro";
        const introTitle = document.createElement("b");
        introTitle.textContent = options.introTitle || "单分类状态";
        const introNote = document.createElement("span");
        introNote.textContent = options.introNote
            || `共 ${raw.length.toLocaleString()} 个 case · 点击状态查看公式`;
        intro.appendChild(introTitle);
        intro.appendChild(introNote);
        containerDiv.appendChild(intro);

        if (!raw.length) {
            const empty = document.createElement("div");
            empty.className = "lsllFamilyNote";
            empty.textContent = "该分类暂无公式。";
            containerDiv.appendChild(empty);
            return;
        }

        const grid = document.createElement("div");
        grid.className = "caseStateGrid";
        const start = (page - 1) * pageSize;
        raw.slice(start, start + pageSize).forEach((row) => grid.appendChild(createCard(row)));
        containerDiv.appendChild(grid);

        if (totalPages > 1) {
            const footer = document.createElement("div");
            footer.className = "formulaPagerWrap";
            footer.appendChild(buildPager(page, totalPages, raw.length, (next) => drawGrid(next, true), "个 case"));
            containerDiv.appendChild(footer);
        }
        if (scroll) requestAnimationFrame(() => intro.scrollIntoView({ block: "start", behavior: "smooth" }));
    };

    // 供两步 LSLL 跳转使用：切到对应页并直接打开公式详情。
    const openCase = (caseName) => {
        const index = raw.findIndex(([name]) => name === caseName);
        if (index < 0) return false;
        page = Math.floor(index / pageSize) + 1;
        openDetail(raw[index]);
        return true;
    };

    drawGrid(1, false);
    return { openCase };
}

// 分类入口：名称里带家族信息的分类先展示「家族卡片」（ZBLL → AS/H/L…），
// 点进家族后再列出该家族的所有 case；没有家族信息的分类保持原来的平铺列表。
function renderCaseStateList(raw, containerDiv, puzzleKey, puzzleType, catKey) {
    const families = getFormulaFamilies(puzzleKey, catKey, raw);
    if (families.length > 1) {
        return renderFamilyCaseStateList(raw, families, containerDiv, puzzleKey, puzzleType, catKey);
    }
    return renderCaseGrid(raw, containerDiv, puzzleKey, puzzleType, catKey);
}

function renderFamilyCaseStateList(raw, families, containerDiv, puzzleKey, puzzleType, catKey) {
    let activeApi = null;

    const showGrid = (scroll = false) => {
        activeApi = null;
        while (containerDiv.firstChild) containerDiv.removeChild(containerDiv.firstChild);

        const intro = document.createElement("div");
        intro.className = "caseStateIntro";
        const introTitle = document.createElement("b");
        introTitle.textContent = `${catKey} · 分类`;
        const introNote = document.createElement("span");
        introNote.textContent = `共 ${families.length} 组 / ${raw.length.toLocaleString()} 个 case · 点击分类查看公式`;
        intro.appendChild(introTitle);
        intro.appendChild(introNote);

        const viewMode = categoryViewMode(puzzleKey, catKey);
        const thumbMode = familyThumbMode(puzzleKey, catKey);
        const stickering = stateStickering(puzzleKey, catKey);
        const grid = document.createElement("div");
        grid.className = "formulaFamilyGrid";
        families.forEach((family) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "formulaFamilyCard";
            card.title = `查看 ${catKey} · ${family.key} 的公式`;

            const thumb = document.createElement("span");
            thumb.className = "formulaFamilyThumb";
            const sample = family.cases[0];
            const displayAlg = sample ? normalizeFormulaAlg(puzzleKey, sample[1]) : "";
            const facelets = displayAlg ? applyAlgToFaceletsForPuzzle(puzzleKey, invertAlg(displayAlg)) : "";

            const mountPlayer = () => {
                lazyMountThumb(thumb, () => {
                    try {
                        const player = makeTwistyPlayer(puzzleType, invertAlg(displayAlg), "", {
                            visualization: "3D",
                            stickering,
                        });
                        player.className = "formulaFamilyPlayer";
                        thumb.appendChild(player);
                        if (stickering) keepSolvedStickers(player);
                    } catch (err) {
                        thumb.textContent = "分类";
                        thumb.classList.add("formulaFamilyThumbEmpty");
                    }
                });
            };

            if (facelets) {
                if (thumbMode === "oll-state") {
                    const ollRow = familyOllRow(puzzleKey, catKey, family.key);
                    const ollAlg = ollRow ? normalizeFormulaAlg(puzzleKey, ollRow[1]) : "";
                    const ollFacelets = ollAlg
                        ? applyAlgToFaceletsForPuzzle(puzzleKey, invertAlg(ollAlg))
                        : "";
                    thumb.innerHTML = topFacePatternSVG(ollFacelets || facelets, 54);
                } else if (thumbMode === "top-yellow") {
                    thumb.innerHTML = topFacePatternSVG(facelets, 54, { label: "顶面状态" });
                } else if (thumbMode === "zbls-3d") {
                    lazyMountThumb(thumb, () => {
                        try {
                            const player = makeTwistyPlayer(puzzleType, invertAlg(displayAlg), "", { visualization: "3D" });
                            player.setAttribute("experimental-stickering", "ZBLS");
                            player.className = "formulaFamilyPlayer";
                            thumb.appendChild(player);
                            keepSolvedStickers(player);
                        } catch (err) {
                            thumb.textContent = "分类";
                            thumb.classList.add("formulaFamilyThumbEmpty");
                        }
                    });
                } else if (viewMode === "3d") {
                    mountPlayer();
                } else if (viewMode === "flat" || isTopLayerOnly(facelets)) {
                    thumb.innerHTML = cubeThumbSVG(facelets, 54, { forceFlat: true });
                } else {
                    mountPlayer();
                }
            } else {
                thumb.textContent = "分类";
                thumb.classList.add("formulaFamilyThumbEmpty");
            }

            const name = document.createElement("span");
            name.className = "formulaFamilyName";
            name.textContent = family.key;
            const count = document.createElement("span");
            count.className = "formulaFamilyCount";
            count.textContent = `${family.cases.length} 条`;

            card.appendChild(thumb);
            card.appendChild(name);
            card.appendChild(count);
            card.onclick = () => showCases(family, true);
            grid.appendChild(card);
        });

        containerDiv.appendChild(intro);
        containerDiv.appendChild(grid);
        if (scroll) requestAnimationFrame(() => intro.scrollIntoView({ block: "start" }));
    };

    const showCases = (family, scroll = false) => {
        activeApi = renderCaseGrid(family.cases, containerDiv, puzzleKey, puzzleType, catKey, {
            paginate: false,
            introTitle: "状态列表",
            header: {
                title: `${catKey} · ${family.key}`,
                backLabel: "← 返回分类",
                onBack: () => showGrid(true),
            },
        });
        if (scroll) requestAnimationFrame(() => {
            const bar = containerDiv.querySelector(".lsllFamilyBar");
            if (bar) bar.scrollIntoView({ block: "start" });
        });
    };

    showGrid();

    return {
        // 回到分类入口的家族网格。
        reset() {
            showGrid(false);
        },
        // 供 LSLL 两步跳转：先定位家族，再打开该家族里的具体 case。
        openCase(caseName) {
            const family = families.find((item) => item.cases.some(([name]) => name === caseName));
            if (!family) return false;
            showCases(family, false);
            return activeApi ? activeApi.openCase(caseName) : false;
        },
    };
}

function renderFormulaList(raw, containerDiv, puzzleKey, puzzleType, catKey = "") {
    if (catKey === "LSLL 一步") {
        renderLsllOneStep(raw, containerDiv, puzzleKey, puzzleType);
        return null;
    }
    if (catKey === "LSLL 两步") {
        renderLsllTwoStep(raw, containerDiv, puzzleKey, puzzleType);
        return null;
    }
    return renderCaseStateList(raw, containerDiv, puzzleKey, puzzleType, catKey);
}

function renderFormulaRows(raw, containerDiv, puzzleKey, puzzleType, catKey = "", options = {}) {
    const pageSize = Number(options.pageSize) || 0;
    const totalPages = pageSize ? Math.max(1, Math.ceil(raw.length / pageSize)) : 1;
    let lastFamily = "";

    const rowsDiv = document.createElement("div");
    const pagerWrap = document.createElement("div");
    pagerWrap.className = "formulaPagerWrap";
    containerDiv.appendChild(rowsDiv);
    containerDiv.appendChild(pagerWrap);

    const appendRow = ([name, alg]) => {
        const family = lsllFamilyLabel(catKey, name);
        if (family && family !== lastFamily) {
            lastFamily = family;
            const heading = document.createElement("div");
            heading.className = "formulaFamily";
            heading.textContent = family;
            rowsDiv.appendChild(heading);
        }

        const item = document.createElement("div");
        item.className = "formulaItem";
        item.dataset.open = "false";
        item.dataset.caseName = name;

        const nameEl = document.createElement("b");
        nameEl.textContent = name;
        item.appendChild(nameEl);
        item.appendChild(document.createTextNode("：" + alg));

        const viewer = document.createElement("div");
        viewer.className = "twistContainer";
        item.appendChild(viewer);

        item.onclick = (e) => {
            if (e.target.tagName.toLowerCase() === "twisty-player") return;
            const box = item.querySelector(".twistContainer");

            if (item.dataset.open === "true") {
                while (box.firstChild) box.removeChild(box.firstChild);
                item.dataset.open = "false";
                return;
            }

            // 一次只展开一个
            document.querySelectorAll(".formulaItem").forEach((el) => {
                const t = el.querySelector(".twistContainer");
                if (t) while (t.firstChild) t.removeChild(t.firstChild);
                el.dataset.open = "false";
            });

            // 只在展示层转换 CubeRoot 的原始记法，不回写公式数据
            const displayAlg = normalizeFormulaAlg(puzzleKey, alg);
            const setup = invertAlg(displayAlg);

            try {
                const player = makeTwistyPlayer(puzzleType, setup, displayAlg, {
                    controlPanel: "bottom-row",
                });
                box.appendChild(player);
                watchPlayerForErrors(player, box, item);
            } catch (err) {
                box.textContent = "⚠️ 当前环境不支持3D渲染";
            }
            item.dataset.open = "true";
        };

        rowsDiv.appendChild(item);
    };

    const drawPage = (page, scroll) => {
        while (rowsDiv.firstChild) rowsDiv.removeChild(rowsDiv.firstChild);
        while (pagerWrap.firstChild) pagerWrap.removeChild(pagerWrap.firstChild);
        lastFamily = "";

        const start = pageSize ? (page - 1) * pageSize : 0;
        const end = pageSize ? Math.min(start + pageSize, raw.length) : raw.length;
        for (let i = start; i < end; i++) appendRow(raw[i]);

        if (pageSize && totalPages > 1) {
            pagerWrap.appendChild(buildPager(page, totalPages, raw.length, (next) => drawPage(next, true), options.unit || "条"));
        }
        if (scroll) requestAnimationFrame(() => rowsDiv.scrollIntoView({ block: "start", behavior: "smooth" }));
    };

    drawPage(1, false);
}

// twisty-player 是异步校验公式的；如果原始记法在对应魔方上无法解析，
// 移除空白播放器并给出提示，避免留下一个不动的 3D 区域。
function watchPlayerForErrors(player, box, item) {
    const model = player.experimentalModel;
    if (!model || !model.puzzleAlg || !model.puzzleSetupAlg) {
        loadTwisty().then((ready) => {
            if (ready && player.isConnected && player.parentNode === box) {
                watchPlayerForErrors(player, box, item);
            }
        });
        return;
    }

    Promise.all([model.puzzleAlg.get(), model.puzzleSetupAlg.get()])
        .then(([algProp, setupProp]) => {
            if (item.dataset.open !== "true" || !box.isConnected) return;
            if (player.parentNode !== box) return; // 已被收起或重新展开
            const errors = []
                .concat((algProp && algProp.issues && algProp.issues.errors) || [])
                .concat((setupProp && setupProp.issues && setupProp.issues.errors) || []);
            if (!errors.length) return;

            while (box.firstChild) box.removeChild(box.firstChild);
            const tip = document.createElement("div");
            tip.className = "twistUnsupported";
            tip.textContent = describePlayerErrors(errors);
            box.appendChild(tip);
        })
        .catch(() => {
            // 校验失败不拦截用户查看公式文本
        });
}

// 把 cubing.js 的英文报错提炼成用户能看懂的提示，方便定位原始记法问题。
function describePlayerErrors(errors) {
    const text = errors.join(" | ");
    const badMoves = Array.from(new Set(
        Array.from(text.matchAll(/Bad move ([^\s,)]+)/g), (m) => m[1])
            .concat(Array.from(text.matchAll(/Could not split ([^\s,)]+) into face names/g), (m) => m[1]))
    ));
    if (badMoves.length) {
        return `⚠️ 该公式含暂不支持的动作：${badMoves.join("、")}`;
    }
    if (/Unexpected character|internal parsing error|unexpected parsing/i.test(text)) {
        return "⚠️ 该公式的原始记法不完整或格式异常，暂不支持 3D 演示";
    }
    return "⚠️ 该公式的原始记法暂不支持 3D 演示";
}

export function initFormulaUI() {
    buildFormulaUI();
    loadTwisty();
}
