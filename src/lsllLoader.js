// 一步 LSLL 按 CubeRoot 的 41 个大类存放在独立文件中，按需加载。
export function lsllOneStepFamilies() {
    const meta = (window.LSLLDB && Array.isArray(window.LSLLDB.families)) ? window.LSLLDB.families : [];
    return meta
        .filter((family) => family && family.key && family.slug && family.file)
        .map((family) => ({
            key: family.key,
            slug: family.slug,
            file: family.file,
            facelets: family.facelets || "",
            count: Number(family.count) || 0,
        }));
}

export function lsllOneStepTotal(families = lsllOneStepFamilies()) {
    return families.reduce((sum, family) => sum + family.count, 0);
}

const lsllFamilyLoads = {};

export function loadLsllOneStepFamily(family) {
    if (window.LSLLOneStep && Array.isArray(window.LSLLOneStep[family.slug])) {
        return Promise.resolve(window.LSLLOneStep[family.slug]);
    }
    if (lsllFamilyLoads[family.slug]) return lsllFamilyLoads[family.slug];

    lsllFamilyLoads[family.slug] = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = family.file;
        script.async = true;
        script.onload = () => {
            const rows = window.LSLLOneStep && window.LSLLOneStep[family.slug];
            if (Array.isArray(rows)) resolve(rows);
            else reject(new Error(`LSLL ${family.key} 数据为空`));
        };
        script.onerror = () => reject(new Error(`LSLL ${family.key} 加载失败`));
        document.head.appendChild(script);
    }).catch((err) => {
        delete lsllFamilyLoads[family.slug];
        throw err;
    });

    return lsllFamilyLoads[family.slug];
}

let lsllAllLoadPromise = null;

export function loadAllLsllOneStep() {
    if (lsllAllLoadPromise) return lsllAllLoadPromise;

    lsllAllLoadPromise = (async () => {
        const families = lsllOneStepFamilies();
        const rows = [];
        for (let i = 0; i < families.length; i += 4) {
            const batch = families.slice(i, i + 4);
            const loaded = await Promise.all(batch.map(loadLsllOneStepFamily));
            loaded.forEach((list) => rows.push(...list));
        }
        if (window.FormulaDB && window.FormulaDB["3x3"]) {
            window.FormulaDB["3x3"]["LSLL 一步"] = rows;
        }
        return rows;
    })().catch((err) => {
        lsllAllLoadPromise = null;
        throw err;
    });

    return lsllAllLoadPromise;
}
