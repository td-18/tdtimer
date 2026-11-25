# 3x3 本地二阶段求解器（M1）

## 文件

| 文件 | 作用 |
|---|---|
| `cubie.js` | 块级模型、六个基本动作、坐标编解码、随机合法状态 |
| `tables.js` | 移动表 + 4 张剪枝表（BFS 距离） |
| `search.js` | Phase 1 / Phase 2 IDA*，多 Phase 1 解取总长最短 |
| `provider.js` | 随机状态 → 求解 → 取逆 → 双向校验 → WCA 记法 |

## 算法

1. 生成随机合法状态：角/棱排列随机，朝向和修正，奇偶性不一致时交换两个棱。
2. Phase 1：用 18 个动作把 `twist / flip / slice` 同时降到 0，进入 G1。
3. Phase 2：用 10 个 G1 动作把 `cperm / eperm / sperm` 归位。
4. 对多条 Phase 1 解分别求 Phase 2，取总长最短。
5. 打乱 = 解的逆；生成后做两次校验：
   - 解作用在随机状态上必须复原；
   - 打乱的逆作用在复原态上必须等于随机状态。

## 表

| 表 | 条目数 | 类型 |
|---|---:|---|
| `twistMove` | 2187 × 18 | Uint16 |
| `flipMove` | 2048 × 18 | Uint16 |
| `sliceMove` | 495 × 18 | Uint16 |
| `cpermMove` | 40320 × 10 | Uint16 |
| `epermMove` | 40320 × 10 | Uint16 |
| `spermMove` | 24 × 10 | Uint8 |
| `twistSlice` | 2187 × 495 | Uint8 |
| `flipSlice` | 2048 × 495 | Uint8 |
| `cpermSperm` | 40320 × 24 | Uint8 |
| `epermSperm` | 40320 × 24 | Uint8 |

M1 使用 raw 坐标，没有对称压缩，也没有 4-bit 打包。表构建约 1.3 秒（worker 内实测），总内存约 10 MB。

## 实测结果

以下数据来自 `tools/wca-m1-check.html` 的最终一轮浏览器实测，不是理论值（每次运行会有波动）：

- 12 个随机状态：全部通过解/打乱双向校验；长度 `[21,22,22,22,22,21,19,21,22,21,22,22]`，平均 21.42，最大 22；单次求解平均约 891 ms，最大约 1503 ms。
- 连续 5 条 333 打乱：长度 `[20,21,21,21,22]`，平均 21.00，最大 22；平均约 803 ms，最大约 1256 ms。
- 表构建：浏览器主线程约 962 ms；worker 内约 1065 ms。
- 首次 333 请求（含 worker 建表）：约 1961 ms。

这些数字明显不如 min2phase（约 0.8 ms、平均 20.6 步）。M1 的目标是“本地、可验证、能接入”，M2 再做对称压缩、Huge prune、6 视图和更激进的剪枝。

## 计时器接入

`src/scramble.js` 已把 3x3 路由到本地 worker；4x4 仍走现有实现。实测：

- 首次 3x3（含建表）：约 2171 ms。
- 后续 next（预取命中）：约 57–249 ms。
- 切到 4x4 再切回 3x3：约 105 ms（表已缓存）。

## 限制

- 3BLD / 3Multi 需要随机朝向，M1 仍交给 legacy 的 oriented scramble；provider 收到 `randomOrientation` 会抛 `DELEGATE_LEGACY`。
- Phase 1 只用 `twist×slice` / `flip×slice` 两张 raw 表，启发式弱于 min2phase 的三表 max。
- 没有使用 3 个 G1 轴 × 正反向的 6 视图。
- 没有使用 pre-move / 对称类压缩 / 4-bit 剪枝表。
- 求解有时间预算，极少数状态会在预算内返回稍长解（目前实测最大 23 步）。

## 测试

```powershell
# 浏览器完整检查
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8903
# 打开 http://127.0.0.1:8903/tools/wca-m1-check.html
```
