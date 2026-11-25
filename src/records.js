// 成绩记录：存取、列表渲染、详情弹窗
import { state } from "./state.js";
import { safeLS } from "./storage.js";
import { renderStats } from "./stats.js";

let activeHistoryIdx = null;

export function recordsKey() {
    // 整个分组：[puzzle, group]；单套：[puzzle, group, cat]
    const scope = state.trainMode ? state.trainMode.filter(Boolean).join("_") : state.puzzle.key;
    return "td_records_" + scope;
}

export function loadRecords() {
    return safeLS.get(recordsKey());
}

function isHistVisible() {
    return document.getElementById("historyPanel").style.display === "flex";
}

export function addRecord(time, scramble, penalty) {
    const r = loadRecords();
    r.unshift({ time, scramble, penalty, date: new Date().toLocaleString() });
    safeLS.set(recordsKey(), r);
    renderStats(r);
    if (isHistVisible()) renderHist();
}

export function setPenalty(index, penalty) {
    const r = loadRecords();
    if (!r[index]) return;
    r[index].penalty = penalty;
    safeLS.set(recordsKey(), r);
    renderStats(r);
    renderHist();
}

export function deleteRecord(index) {
    const r = loadRecords();
    r.splice(index, 1);
    activeHistoryIdx = null;
    safeLS.set(recordsKey(), r);
    renderStats(r);
    renderHist();
}

export function clearRecords() {
    safeLS.remove(recordsKey());
    activeHistoryIdx = null;
    renderStats([]);
    renderHist();
}

export function renderHist() {
    const r = loadRecords();
    renderStats(r);

    const box = document.getElementById("historyList");
    while (box.firstChild) box.removeChild(box.firstChild);

    r.forEach((x, i) => {
        const row = document.createElement("div");
        row.className = "history-item";

        const left = document.createElement("span");
        left.className = "history-left";

        const num = document.createElement("span");
        num.className = "history-index";
        num.textContent = String(r.length - i);

        const time = document.createElement("span");
        time.className = "history-time";
        time.textContent = x.penalty === "DNF"
            ? "DNF"
            : ((x.time + (x.penalty === "+2" ? 2000 : 0)) / 1000).toFixed(2);

        if (x.penalty) {
            const tag = document.createElement("span");
            tag.className = "penalty " + (x.penalty === "+2" ? "p2" : "dnf");
            tag.textContent = x.penalty;
            time.appendChild(tag);
            // 只有 +2 才需要显示原始时间；DNF 没有有效原始时间
            if (x.penalty === "+2") {
                const raw = document.createElement("span");
                raw.className = "raw-time";
                raw.textContent = `(${(x.time / 1000).toFixed(2)})`;
                time.appendChild(raw);
            }
        }

        left.appendChild(num);
        left.appendChild(time);

        const date = document.createElement("span");
        date.className = "date-text";
        date.textContent = x.date;

        row.appendChild(left);
        row.appendChild(date);

        row.onclick = () => {
            activeHistoryIdx = i;
            document.getElementById("detailScramble").textContent = x.scramble;
            document.getElementById("detailDate").textContent = "记录时间: " + x.date;
            document.getElementById("detailModal").classList.add("show");
        };

        box.appendChild(row);
    });
}

export function initRecordsUI() {
    const modal = document.getElementById("detailModal");

    document.getElementById("btnStatTab").onclick = () => {
        document.getElementById("btnStatTab").classList.add("active");
        document.getElementById("btnHistoryTab").classList.remove("active");
        document.getElementById("statPanel").style.display = "block";
        document.getElementById("historyPanel").style.display = "none";
    };

    document.getElementById("btnHistoryTab").onclick = () => {
        document.getElementById("btnHistoryTab").classList.add("active");
        document.getElementById("btnStatTab").classList.remove("active");
        document.getElementById("statPanel").style.display = "none";
        document.getElementById("historyPanel").style.display = "flex";
        renderHist();
    };

    document.getElementById("closeDetailBtn").onclick = () => {
        modal.classList.remove("show");
        activeHistoryIdx = null;
    };

    document.getElementById("detailPenaltyBtns").onclick = (e) => {
        const btn = e.target.closest("button");
        if (!btn || activeHistoryIdx === null) return;

        const act = btn.dataset.act;
        if (act === "del") {
            deleteRecord(activeHistoryIdx);
            document.getElementById("closeDetailBtn").click();
            return;
        }
        if (act === "p2") setPenalty(activeHistoryIdx, "+2");
        else if (act === "dnf") setPenalty(activeHistoryIdx, "DNF");
        else if (act === "clear") setPenalty(activeHistoryIdx, "");

        const r = loadRecords();
        if (r[activeHistoryIdx]) {
            document.getElementById("detailScramble").textContent = r[activeHistoryIdx].scramble;
            document.getElementById("detailDate").textContent = "记录时间: " + r[activeHistoryIdx].date;
        }
    };

    document.getElementById("clearRecordsBtn").onclick = () => {
        if (confirm("清空当前记录？")) clearRecords();
    };
}
