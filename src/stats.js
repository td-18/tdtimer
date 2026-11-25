// 成绩计算：mo3 / ao5 / ao12 及历史最佳
// 规则：mo3 去掉最好最差取中间；aoN 去掉最好最差取平均
// DNF：mo3 有 DNF 即无效；aoN 允许 1 个 DNF（按最差剔除），2 个及以上无效
export function recTime(r) {
    return r.penalty === "DNF" ? Infinity : r.time + (r.penalty === "+2" ? 2000 : 0);
}

export function calcA(recs, n) {
    if (recs.length < n) return null;
    const v = recs.slice(0, n).map(recTime);
    const dnf = v.filter((x) => x === Infinity).length;
    if (n === 3 ? dnf > 0 : dnf >= 2) return null;
    v.sort((a, b) => a - b);
    return v.slice(1, -1).reduce((a, b) => a + b, 0) / (n - 2);
}

// 历史上所有窗口里最好的成绩
export function bestA(recs, n) {
    let best = null;
    for (let i = 0; i + n <= recs.length; i++) {
        const v = calcA(recs.slice(i, i + n), n);
        if (v !== null && (best === null || v < best)) best = v;
    }
    return best;
}

export function setStat(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = (v === null || !isFinite(v)) ? "-" : (v / 1000).toFixed(2);
}

export function renderStats(records) {
    const cur = records.length ? recTime(records[0]) : null;
    const curEl = document.getElementById("curSingle");
    if (curEl) {
        curEl.textContent = cur === null ? "-" : (cur === Infinity ? "DNF" : (cur / 1000).toFixed(2));
    }
    setStat("bestSingle", records.length ? Math.min(...records.map(recTime)) : null);
    [["mo3", "bestMo3", 3], ["ao5", "bestAo5", 5], ["ao12", "bestAo12", 12],
     ["ao50", "bestAo50", 50], ["ao100", "bestAo100", 100]].forEach(([id, bid, n]) => {
        setStat(id, calcA(records, n));
        setStat(bid, bestA(records, n));
    });
}
