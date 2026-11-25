// 页面导航与魔方项目下拉（WCA 全部 17 个项目）
import { pList, state } from "./state.js";

export function showPage(id, clearTabs = false) {
    document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));
    const page = document.getElementById(id);
    if (page) page.style.display = "block";
    if (clearTabs) {
        document.querySelectorAll(".tab button").forEach((b) => b.classList.remove("active"));
    }
}

export function showTab(id) {
    document.querySelectorAll(".tab button").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === id);
    });
    showPage(id);
}

export function initNav() {
    document.querySelectorAll(".tab button").forEach((btn) => {
        btn.onclick = () => showTab(btn.dataset.tab);
    });
    // 蓝牙、设置均以卡片弹窗展示
    const bindCardModal = (modalId, buttonId, closeBtnId) => {
        const modal = document.getElementById(modalId);
        const btn = document.getElementById(buttonId);
        const close = () => {
            modal.classList.remove("show");
            btn.setAttribute("aria-expanded", "false");
        };
        btn.onclick = () => {
            modal.classList.add("show");
            btn.setAttribute("aria-expanded", "true");
        };
        document.getElementById(closeBtnId).onclick = close;
        modal.addEventListener("click", (e) => {
            if (e.target === modal) close();
        });
        return { modal, close };
    };

    const cardModals = [
        bindCardModal("bluetoothModal", "navBluetooth", "closeBluetoothBtn"),
        bindCardModal("settingsModal", "navSettings", "closeSettingsBtn"),
    ];

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        cardModals.forEach(({ modal, close }) => {
            if (modal.classList.contains("show")) close();
        });
    });
}

export function initPuzzleDropdown(onChange) {
    const btn = document.getElementById("puzzleMainBtn");
    const list = document.getElementById("puzzleDropdownList");
    let open = false;

    // 菜单由 pList 动态生成，新增项目时只改 state.js，不会和 HTML 顺序脱节。
    while (list.firstChild) list.removeChild(list.firstChild);
    btn.textContent = state.puzzle.name;

    const close = () => {
        open = false;
        list.classList.remove("show");
        btn.setAttribute("aria-expanded", "false");
    };

    const options = [];
    let lastGroup = "";

    pList.forEach((puzzle) => {
        if (puzzle.group && puzzle.group !== lastGroup) {
            lastGroup = puzzle.group;
            const label = document.createElement("div");
            label.className = "puzzleGroupLabel";
            label.setAttribute("role", "presentation");
            label.textContent = puzzle.group;
            list.appendChild(label);
        }

        const opt = document.createElement("div");
        opt.className = "puzzleOption" + (puzzle.key === state.puzzle.key ? " active" : "");
        opt.setAttribute("role", "menuitem");
        opt.tabIndex = 0;
        opt.textContent = puzzle.name;
        opt.dataset.key = puzzle.key;

        const select = async () => {
            close();
            btn.textContent = puzzle.name;
            options.forEach((o) => o.classList.toggle("active", o === opt));
            await onChange(puzzle);
        };

        opt.onclick = select;
        opt.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select();
            }
        };

        list.appendChild(opt);
        options.push(opt);
    });

    btn.onclick = (e) => {
        e.stopPropagation();
        open = !open;
        list.classList.toggle("show", open);
        btn.setAttribute("aria-expanded", String(open));
        if (open) {
            const active = list.querySelector(".puzzleOption.active");
            if (active) active.scrollIntoView({ block: "nearest" });
        }
    };

    document.addEventListener("click", () => {
        if (open) close();
    });
}
