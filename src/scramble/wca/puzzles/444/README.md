# 4x4 本地随机状态求解器（M3）

## 文件

| 文件 | 内容 |
|---|---|
| `solver.js` | 离线打包的 4x4 随机状态求解器 |
| `provider.js` | 初始化缓存、进度、随机状态输出 |

## 行为

- 首次请求在 worker 内构建中心/棱块剪枝表，约 1.5–2 s；
- 初始化 progress：`{ phase: "init", stage, percent }`；
- 求解 progress：`{ phase: "solve", current, total }`；
- 表在 worker 内缓存，后续生成约 150–250 ms；
- 输出 40–50 步的随机状态打乱；
- 4BLD 的 `randomOrientation` 仍返回 `DELEGATE_LEGACY`。

## 来源与许可

`solver.js` 是以下 csTimer（GPLv3）文件的离线拼接版本，只加了模块化
shim、进度回调和导出：

- `isaac.js`
- `min2phase.js`
- `mathlib.js`
- `scramble_333_edit.js`
- `scramble_444.js`

M5 许可审计时需要确认整体分发许可，或替换为 clean-room 实现。
