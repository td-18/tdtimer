# WCA 打乱工程 · M0 骨架 + M1/M2/M3/M4 本地打乱

M0 搭好了事件注册、规则、worker 协议、主线程客户端和 legacy 兜底；M1 接入了
3x3、2x2、Pyraminx、Skewb；M2 接入了 Clock 和 Square-1；M3 接入了
5x5 / 6x6 / 7x7 的本地随机转动；M4 接入了 Megaminx 的 Pochmann 随机转动。
计时器前端下拉现在覆盖全部 17 个 WCA 官方项目。

## 当前状态

| 打乱器 | 状态 | 当前行为 |
|---|---|---|
| 3x3 / 3OH / FMC | **ready（M1）** | worker 内本地二阶段求解器 |
| 3BLD / 3Multi | legacy | provider 返回 `DELEGATE_LEGACY`，复用 cubing.js 的随机朝向 |
| 2x2 | **ready（M1）** | worker 内 3,674,160 规范状态全表 BFS，最优解 |
| Pyraminx | **ready（M1）** | worker 内 933,120 可达状态全表 BFS，最优解 |
| Skewb | **ready（M1）** | worker 内 3,149,280 可达状态全表 BFS，最优解 |
| Square-1 | **ready（M2）** | worker 内两阶段随机状态求解器，至少 11 个 `/` |
| Clock | **ready（M2）** | worker 内 Z/12Z 线性代数随机状态生成器，12^14 状态 |
| Megaminx | **ready（M4）** | 7 行 × (5 组 R/D + U/U') 的 Pochmann 随机转动，共 77 步 |
| 5x5 | **ready（M3）** | 60 步本地随机转动，最多两层宽 |
| 6x6 | **ready（M3）** | 80 步本地随机转动，最多三层宽 |
| 7x7 | **ready（M3）** | 100 步本地随机转动，最多三层宽 |
| 4x4 | **ready（M3）** | 本地随机状态求解器（reduction + 3x3），40–50 步 |
| 4BLD / 5BLD | legacy | 随机朝向交给 cubing.js；4BLD/5BLD 复用 4x4/5x5 但会委托 legacy |
| FTO | **reserved** | 默认拒绝，等 2027 WCA 更新后再启用 |

`src/scramble.js` 会读取 `state.js` 里的 `local` 字段，把本地项目接到 worker：

- 333、222、444、555、666、777、clock、sq1、minx、pyra、skewb；
- 333OH / FMC 复用 333；盲拧项目保留 legacy 随机朝向；
- 每个项目独立预取下一把；切换项目时不会互相覆盖缓存；
- 本地失败时仍回退到原来的 cubing.js / 本地短公式路径；
- 4x4 已从 legacy delegated 切换为本地随机状态 provider。

cubing.js 的事件 id 和 WCA 记法不完全一致，适配层已经处理：

| 项目 | 本模块 event | cubing.js id |
|---|---|---|
| Pyraminx | `pyra` | `pyram` |
| 3x3 盲拧 | `333bf` | `333bf`（随机朝向） |
| 3x3 多盲 | `333mbf` | `333mbf`（随机朝向） |
| 4x4 盲拧 | `444bf` | `444bf`（随机朝向） |
| 5x5 盲拧 | `555bf` | `555bf`（随机朝向） |

> 计时器 UI 的 `state.js` 现在覆盖 WCA 全部 17 个官方项目，下拉菜单由 `ui.js`
> 动态生成，分组为：N×N、三阶变体、盲拧、异形。每个项目通过 `local` 字段指定本地 worker id：
> 333、222、555、666、777、clock、sq1、minx、pyra、skewb；
> 333OH / FMC 复用 333 本地生成器，盲拧项目保留 legacy 随机朝向。
> Pyraminx 的本地 provider 是 `pyra`，cubing.js 的 legacy id 是 `pyram`。

## 目录

```
src/scramble/wca/
  events.js       事件注册表 + 17 个官方项目 + FTO 预留
  rules.js        4b3 规则与基础校验
  notation.js     记法解析 / 求逆 / 同面合并 / token 校验
  rng.js          crypto 随机源 + 测试用种子 PRNG
  protocol.js     主线程 <-> worker 协议
  providers.js    本地 provider 注册表
  legacy.js       cubing.js 兜底适配器
  worker.js       module worker 入口
  client.js       ScrambleService（请求、超时、取消、回退）
  index.js        对外 API
  puzzles/
    index.js      内置 provider 注册
    scaffold.js   预留项目占位 provider 工厂（当前没有注册的占位项目）
    lib/perm.js   排列 rank/unrank 等共用工具
    333/          二阶段求解器
    222/          全表 BFS 最优解
    444/          离线打包的 4x4 随机状态求解器
    pyra/         全表 BFS 最优解
    skewb/        全表 BFS 最优解
    clock/        Clock 线性代数随机状态生成器（M2）
    sq1/          Square-1 两阶段随机状态求解器（M2）
    bigcube/      5x5/6x6/7x7 随机转动生成器（M3）
    555/          5x5 provider
    666/          6x6 provider
    777/          7x7 provider
    minx/         Megaminx Pochmann 随机转动（M4）
```

## 用法

```js
import { generateScramble, getScrambleCapabilities } from "./scramble/wca/index.js";

const caps = await getScrambleCapabilities();
const two = caps.scramblers.find((s) => s.id === "222");
console.log(two.local, two.implemented, two.algorithm);
// M1: "ready" true "full-bfs-optimal"

const result = await generateScramble("222", { count: 1 });
console.log(result.scrambles, result.source); // source === "worker"
```

指定超时/取消：

```js
const controller = new AbortController();
const promise = generateScramble("skewb", {
    signal: controller.signal,
    timeoutMs: 30000,
});
controller.abort();
```

多盲去重：

```js
const result = await generateScrambleGroup("333mbf", 20);
// event.dedupe = true，client 会在 legacy 路径重试直到拿到 20 条不重复打乱
```

FTO 默认不可用：

```js
await generateScramble("fto");
// Error code: EVENT_UNAVAILABLE, details.availableFrom === "2027"
```

如果 2027 更新后需要临时打开：

```js
await generateScramble("fto", { allowReserved: true });
// 仍会尝试 legacy；cubing.js 不支持时会返回 ALL_SOURCES_FAILED
```

## Provider 契约

每个本地项目实现成一个 provider：

```js
{
    init?({ event, onProgress }) => Promise<void> | void,
    async generate({ event, count, options, onProgress }) {
        return ["R U R' U'", "..."]; // 必须返回 count 条
    },
    meta: { algorithm: "..." },
}
```

worker 会对返回值做结构校验、去重校验和 4b3 基础规则校验。

未来预留项目的占位 provider 可以带 `scaffold: true` 和 `milestone`：

```js
{
    algorithm: "fto-experimental",
    milestone: "2027",
    scaffold: true,
}
```

worker 行为：

- `init` 返回 `status: "scaffolded"`、`available: false`。
- `generate` 直接返回 `DELEGATE_LEGACY`，主线程 client 回退到 cubing.js。
- capabilities 里额外暴露 `hasProvider`、`implemented`、`scaffold`、`algorithm`。

## Worker 协议

请求：

```js
{ protocol: 1, kind: "request", id: "req-1", type: "generate", payload: { event: "222", count: 1, options: {} } }
```

成功：

```js
{ protocol: 1, kind: "response", id: "req-1", ok: true, result: { scrambles: ["..."], meta: {} } }
```

失败：

```js
{ protocol: 1, kind: "response", id: "req-1", ok: false, error: { code: "NOT_IMPLEMENTED", message: "..." } }
```

进度：

```js
{ protocol: 1, kind: "event", id: "req-1", event: "progress", data: { phase: "init", percent: 42 } }
```

错误码见 `protocol.js`：`NOT_IMPLEMENTED`、`DELEGATE_LEGACY`、`EVENT_UNAVAILABLE`、
`TIMEOUT`、`INVALID_SCRAMBLE` 等。

## M1 本地求解器

### 3x3

`puzzles/333/` 是 raw 坐标二阶段求解器：块级模型、移动表、4 张剪枝表、
Phase 1 / Phase 2 IDA*，随机状态后求解并取逆。

### 2x2

`puzzles/222/` 把 URF 角块规范到 0 号槽位、朝向 0，得到
`7! * 3^6 = 3,674,160` 个规范状态。全表 BFS 得到最优距离（最大 11 步）。

- 规范坐标下 U/D、R/L、F/B 是同一变换，BFS 只用 9 个不同变换；
- 生成打乱时在等价 token 里随机选择，保留六面记法；
- 4b3b 要求至少 4 步，距离 <4 的状态会被重新抽取；
- 打乱生成后用距离表从复原态复算，必须回到同一个规范状态。

### Pyraminx

`puzzles/pyra/` 是 6 棱块 + 4 角尖模型，索引空间 `720 * 32 * 81 = 1,866,240`，
其中 `933,120` 个状态可达。全表 BFS 最大 11 步。

- 16 个动作：U/L/R/B 各两个方向，u/l/r/b 各两个方向；
- 4b3f 要求至少 6 步；
- 随机状态在完整索引空间采样，用 `distance >= 0` 过滤不可达状态，
  因此可达状态上是均匀分布。

### Skewb

`puzzles/skewb/` 使用 6 中心 + 4 可转动角 + 4 固定角的坐标：

- 索引空间 `360 * 12 * 81 * 27 = 9,447,840`；
- 可达状态 `3,149,280`；
- 8 个动作（4 轴 × 2 方向），全表 BFS 最大 11 步；
- 4b3c 要求至少 7 步。

## M2 本地生成器

### Clock

`puzzles/clock/` 把 14 个独立表盘看成 Z/12Z 上的线性空间：

- 18 个动作向量（正面/背面各 9 个）；
- 随机 14 个表盘，解 14 元线性方程组（mod 12），把状态表示成动作序列；
- 选非零动作最少的表示，输出正面动作 / `y2` / 背面动作 / 随机引脚；
- 4b3 要求至少 2 步，距离 <2 会重抽；
- 输出会从复原态复算，必须与随机状态一致。

### Square-1

`puzzles/sq1/` 是两阶段随机状态求解器：

- 形状表：7,536 个形状索引，BFS 形状距离；
- 排列表：8 角 + 8 棱的排列距离；
- 搜索：先回到可做 `/` 的形状，再复原角/棱排列与中层；
- 4b3d 要求至少 11 步，并保证输出至少 11 个 `/`；
- provider 用状态模拟器做逆序列复算。

## M3 本地生成器

### 4x4

`puzzles/444/` 使用离线打包的 4x4 随机状态求解器：

- 首次初始化中心/棱块剪枝表，约 1.5–2 s；
- 初始化阶段通过 worker progress 上报 `init` 百分比；
- 表在同一 worker 内缓存，后续生成约 150–250 ms；
- 输出 40–50 步的随机状态打乱；
- 4BLD 需要随机朝向，仍委托 legacy。

### 5x5 / 6x6 / 7x7

`puzzles/bigcube/` 是共享的大魔方随机转动生成器：

- 5x5：60 步，外层 + 两层宽；
- 6x6：80 步，外层 + 两层/三层宽；
- 7x7：100 步，外层 + 两层/三层宽；
- 过滤连续同轴动作（例如 R 后接 L）；
- WCA 4b3e 允许大魔方使用随机转动，不要求随机状态。

4x4 已接入本地随机状态求解器；5BLD 复用 5x5 provider 但需要随机朝向，
目前和 3BLD/4BLD 一样委托 legacy。

## M4 本地生成器

### Megaminx

`puzzles/minx/` 使用 Pochmann 记法的随机转动：

- 7 行；
- 每行 5 组 `R`/`D`（随机 `++` / `--`），最后加一个 `U` 或 `U'`；
- 每行 11 个动作，共 77 步；
- 只使用 `R++`、`R--`、`D++`、`D--`、`U`、`U'`，与 `notation.js` 的
  Megaminx 记法一致；
- WCA 4b3e 允许 Megaminx 使用随机转动，不要求随机状态。

### 实测数据

Node 22 / Chromium 实测，运行间会波动：

| 项目 | 状态空间 | 表构建（Node） | 表构建（浏览器） | 打乱长度 | 单次生成 |
|---|---|---|---|---|---|
| 2x2 | 3,674,160 | 约 2.9–4.6 s | 约 5.1–8.2 s | 平均约 9.0，最大 10–11 | < 2 ms |
| 4x4 | 随机状态 | 约 1.5–2 s（首次） | 约 2–4 s（首次） | 约 40–50 步 | 约 150–250 ms |
| Pyraminx | 933,120 可达 | 约 0.25–0.3 s | 约 0.3–0.9 s | 平均约 7.4–7.8，最大 9 | < 2 ms |
| Skewb | 3,149,280 可达 | 约 1.9–2.4 s | 约 3.4–5.8 s | 平均约 8.3–8.5，最大 9–10 | < 5 ms |
| Clock | 12^14 | 无表 | 无表 | 约 9–14 个非零动作 | 约 50–150 ms |
| Square-1 | 形状 + 排列表 | 约 0.25–0.5 s | 约 0.5–1 s | 至少 11 个 `/` | 约 20–80 ms |
| 5x5 | 随机转动 | 无表 | 无表 | 60 步 | < 1 ms |
| 6x6 | 随机转动 | 无表 | 无表 | 80 步 | < 1 ms |
| 7x7 | 随机转动 | 无表 | 无表 | 100 步 | < 1 ms |
| Megaminx | 随机转动 | 无表 | 无表 | 77 步（7 行） | < 1 ms |
| 3x3 | 二阶段搜索 | 约 1.0 s | 约 1.0 s | 平均约 21 | 约 0.8–1.5 s |

浏览器冒烟页 `tools/wca-m1-more-check.html` 的项目还包括 Clock 和 Square-1：

- 2x2 首次约 3–5.5 s（含建表），之后约 100–300 ms；
- Pyraminx 首次约 0.5–1.3 s，之后约 100–300 ms；
- Skewb 首次约 3–6.3 s，之后约 100–300 ms；
- Clock 首次约 0.2–0.5 s，之后约 50–150 ms；
- Square-1 首次约 0.2–0.6 s（含建表），之后约 20–80 ms。

2x2/Pyraminx/Skewb 的输出是**最优解取逆**，所以有时比 TNoodle 的
随机状态打乱更短（尤其 Pyraminx 会出现 6–8 步）。这满足 4b3 的最小步数要求，
但观感上会比比赛打乱短。

## 测试

纯逻辑测试（Node 18+）：

```bash
node --test tests/*.test.mjs
```

新增测试：

- `tests/wca-m1-222.test.mjs`：2x2 动作、规范坐标、BFS 全状态覆盖、provider 输出
- `tests/wca-m1-pyra.test.mjs`：Pyraminx 动作、933,120 可达状态、provider 输出
- `tests/wca-m1-skewb.test.mjs`：Skewb 动作、3,149,280 可达状态、provider 输出
- `tests/wca-m2-clock.test.mjs`：Clock 线性代数、记号/引脚、provider 输出
- `tests/wca-m2-sq1.test.mjs`：Square-1 形状/排列表、随机状态、`/` 规则、provider 输出
- `tests/wca-m3-444.test.mjs`：4x4 随机状态、缓存、初始化进度
- `tests/wca-m3-bigcube.test.mjs`：5x5/6x6/7x7 步数、记法、同轴过滤、5BLD 委托
- `tests/wca-m4-minx.test.mjs`：Megaminx 7 行格式、77 步、provider 输出
- `tests/wca-m1-scaffold.test.mjs`：provider 注册表、全部本地项目 ready、scaffold 工厂

浏览器冒烟页（需要 HTTP 服务，worker 不能走 `file://`）：

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8903
# M0 骨架检查： http://127.0.0.1:8903/tools/wca-m0-check.html
# M1 3x3 检查： http://127.0.0.1:8903/tools/wca-m1-check.html
# M1/M2/M3/M4 全部本地项目： http://127.0.0.1:8903/tools/wca-m1-more-check.html
```

也可以用 `python -m http.server 8903`，只要能从项目根目录提供静态文件即可。

## 已知限制

- 2x2/Pyraminx/Skewb 使用全表 BFS，首次建表需要几秒；worker 按项目懒加载并缓存，
  但每个项目首次请求会有明显延迟。M5 再考虑预计算/压缩表、4-bit 距离和离线打包。
- 2x2 首次建表在低端浏览器上可能超过 5 s，主线程已把默认超时放宽到 30 s。
- 2x2/Pyraminx/Skewb 输出最优解，步数通常短于比赛打乱；如果后续要求更接近
  TNoodle 的长度分布，需要额外的随机 AUF / 非最优解策略。
- Clock 每次生成要跑一遍 14 元线性方程组，约 50–150 ms；M5 可考虑缓存/预计算。
- Square-1 的表构建和搜索依赖递归，首次约 0.25–1 s；输出保证至少 11 个 `/`，
  但长度分布仍可能与 TNoodle 不同。
- Megaminx 是 Pochmann 随机转动，不是随机状态；这是 WCA 4b3e 允许的做法。
- 5x5/6x6/7x7 是随机转动，不是随机状态；这是 WCA 4b3e 允许的做法。
- 4x4 本地求解器为离线打包的第三方实现（csTimer，GPLv3），M5 许可审计时
  需要确认分发许可或替换为 clean-room 实现。
- 4BLD/5BLD 仍走 legacy 的随机朝向；4x4/5x5 provider 收到 `randomOrientation` 会委托。
- `rules.js` 只能验证记法结构；本地 provider 会用自己的距离表保证 4b3 最小步数，
  legacy 路径仍只能给 `MIN_MOVES_NOT_VERIFIED` 警告。
- 3BLD / 3Multi 仍走 legacy 的随机朝向；本地 3x3 provider 不处理 `randomOrientation`。

## 许可提醒

本项目整体以 **GPL-3.0-only** 分发；完整许可证见根目录 `LICENSE`，
第三方组件和授权状态见根目录 `THIRD_PARTY_NOTICES.md`。

- TNoodle：GPLv3。
- min2phase：GPLv3 + MIT 双许可。
- cubing.js：以仓库 LICENSE 为准。
- 2x2 / Pyraminx / Skewb 的 M1 实现参考了公开的块级坐标和动作模型
  （Kociemba 角块编号、csTimer 的 Pyraminx / Skewb 模型），代码为本地重写。
- 4x4 的 `solver.js` 是 csTimer（GPLv3）的离线拼接版本，包含
  isaac / min2phase / mathlib / scramble_333_edit / scramble_444。
- CubeRoot 公式数据已获得魔方根（CubeRoot）口头公开许可，书面许可待补。

当前项目按 GPLv3 开源，4x4 的 GPLv3 代码与整体许可兼容；如果以后需要闭源，
再替换 4x4/FTO 的第三方求解器或做 clean-room 实现。
