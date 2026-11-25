// 公式库项目图标：使用 WCA 官方平面项目图标（@cubing/icons，与 WCA 官网同款）。
// 单色字形，颜色跟随父级 color；只用于界面展示，不参与公式数据或转动逻辑。

const ICON_CLASS = {
    "3x3": "event-333",
    "2x2": "event-222",
    "4x4": "event-444",
    "5x5": "event-555",
    "6x6": "event-666",
    "fto": "unofficial-fto",
    "megaminx": "event-minx",
    "pyraminx": "event-pyram",
    "skewb": "event-skewb",
    "sq1": "event-sq1",
};

export function puzzleIconHTML(puzzleKey, size = 40) {
    const iconClass = ICON_CLASS[puzzleKey] || ICON_CLASS["3x3"];
    return `<span class="cubing-icon ${iconClass} puzzleIcon" style="font-size:${size}px" aria-hidden="true"></span>`;
}
