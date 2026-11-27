# 技术结构与边界

## 技术栈

- 纯静态站点：四个入口 HTML + `styles.css` + 原生 ES Module，无打包、无构建。
- 部署：Cloudflare Pages，推送即上线。
- 外部能力：cubing.js 通过 CDN 提供部分打乱兜底、公式 3D 和 SQ1 状态计算；
  打乱和 3D 加载均有 5 秒超时，公式 3D 失败时降级为平面图。
- 目标环境：手机 Chrome / Safari，触控优先；桌面可用。
- 测试：Node 内置 `node --test`，不安装额外测试框架。
- 静态检查：ESLint（仅开发期，`npm run lint`），只做正确性检查，不参与
  前端构建。
- 云端能力（暂缓，条件触发）：Cloudflare Workers + D1 + KV + R2；前端仍无构建，
  后端独立目录部署。方案见 [`cloud-plan.md`](./cloud-plan.md)。

## 目录与模块

```text
index.html            首页：计时 / 公式 / 训练三个入口板块
timer.html            计时入口：计时、蓝牙、设置
formula.html          公式入口：公式库浏览
training.html         训练入口：现有分组 / 套训练 + 计时记录
favicon.svg           本地图标
styles.css            全站样式
formulas.js           公式数据，挂到 window.FormulaDB
data/
  cuberoot.js         CubeRoot 公式数据
  lsll.js             LSLL 两步数据与分类元数据
  lsll-one-step/      一步 LSLL 的 41 个大类文件，按需加载
src/
  timer-entry.js      计时页装配
  formula-entry.js    公式页装配
  training-entry.js   训练页装配
  main.js             旧入口兼容，转发到 timer-entry
  loadGuard.js        Promise 超时保护
  flatCubeView.js     本地六面平面展开图渲染
  twistyView.js       cubing.js 3D 异步加载与平面图降级
  algInverse.js       不依赖 CDN 的公式求逆
  lsllLoader.js       一步 LSLL 大类文件按需加载
  state.js            全局状态、17 个项目列表、常量、兜底公式
  storage.js          localStorage 安全读写（失败静默降级）
  stats.js            mo3 / aoN / 最佳成绩计算
  records.js          成绩存取、列表、详情、+2 / DNF / 删除
  timer.js            计时状态机、观察、触控 / 键盘输入
  ui.js               页签与项目下拉
  scramble.js         计时页打乱调度、cubing.js 超时与本地降级
  formula.js          公式库浏览、状态卡与 3D 演示
  training.js         训练分组、套选择与训练题生成
  formulaSets.js      项目分组 / 套的元数据
  formulaFamilies.js  家族分类规则（ZBLL、COLL 等）
  algNotation.js      公式记号、视角与项目映射
  cubeThumb.js        平面缩略图、六面展开图与贴纸模拟
  sq1Thumb.js         SQ1 自绘缩略图与黑白平面图
  puzzleIcons.js      WCA 项目图标
  scramble/wca/       本地 WCA 打乱引擎
  solver/             求解器：公式候选生成 + 任意起止完整解
    index.js          候选生成入口、端点解析（公式 / 类别 / CubieCube）
    bidirectional.js  动作族内双向 BFS
    complete.js       任意 A→B 完整解，复用 333 二阶段求解器
    dr.js             任意状态 → DR（G1）的最短解
    capacity.js       搜索规模估算与长度上限
    moveset.js        动作集解析与化简
    filter.js         候选筛选（允许面 / 长度）
    cases.js          公式与状态互转
    llcases.js        顶层状态类别（OLL / PLL / COLL / ELL）
    selftest.js       solver.html 自检
  hardware/           蓝牙设备（M1：GAN 计时器 + GAN 魔方）
    transport.js      Web Bluetooth 封装：请求 / 连接 / 订阅 / 写队列
    registry.js       名称前缀 + 服务 UUID → 设备画像
    session.js        连接流程、事件流、设备状态汇总
    mac.js            MAC 解析与 localStorage 缓存
    aes.js            同步 AES-128-CBC
    protocols/        gan-timer.js、gan.js
    ui.js             蓝牙弹窗与计时联动
tests/                node:test 纯逻辑测试
tools/                本地静态服务器、数据抓取、浏览器冒烟页
  worker/               云端 API（暂缓，不参与前端构建）
docs/                 项目文档与 AI 文档库
```

### 页面加载边界

- 首页不加载 `data/`、应用模块或 cubing.js；六面展开图是内联 SVG。
- 计时页只加载计时、成绩、蓝牙、打乱与平面状态图，不加载公式数据。
- 公式页加载 `data/cuberoot.js`、`data/lsll.js`、`formulas.js` 和公式浏览模块，
  不加载计时、成绩或蓝牙。
- 训练页加载公式数据、训练、计时和成绩，不加载 WCA worker；训练题由公式求逆生成。
- 三个功能页通过普通链接互相跳转，不保留旧的单页 Tab 状态。

## 关键数据流

### 计时与成绩

- 状态机：`idle → readyCount（长按 0.8s）→ running`。
- 观察：开启后 15 秒，超过 15s 记 +2，超过 17s 判 DNF。
- 成绩存 localStorage，key 由 `recordsKey()` 生成：
  - 普通模式：`td_records_<puzzle.key>`，如 `td_records_3x3x3`
  - 训练模式：`td_records_<puzzle>_<group>[_<cat>]`
- 记录字段：`time`（毫秒）、`scramble`、`penalty`（`"+2"` / `"DNF"` / 空）、`date`。
- 修改存储结构必须兼容读取旧数据，不能直接丢历史成绩。

### 打乱

- `state.pList` 的 `local` 字段决定是否走本地引擎；没有 `local` 的项目
  （如三阶盲拧、多盲）走 cubing.js。
- 本地引擎：`src/scramble/wca/`，worker 中按项目 provider 求随机状态，
  超时或失败时回退 cubing.js。
- 请求带序号（`genToken`），快速切项目 / 连点 next 时丢弃过期结果。
- 训练题不由计时页的打乱模块生成，见下文“训练”。

### 公式库

- 数据来源：`window.FormulaDB`（`data/cuberoot.js`）、`data/lsll.js`、
  `data/lsll-one-step/*.js`。
- 浏览结构：状态卡 → 公式 + 3D 演示；三级 / 二阶部分分类多一层家族。
- 状态与缩略图：由公式反推状态，平面图 / 3D 按分类规则选择；
  SQ1 使用自绘缩略图；缩略图进入视口前不创建 3D 场景。
- cubing.js 的 `twisty-player` 异步加载；失败时显示平面状态图。
- 分页只用于 LSLL；其他分类一次展示全部状态。
- 详细绘制规则见 [`../formula-thumbnails.md`](../formula-thumbnails.md)。

### 训练

- 训练页复用公式库的项目、分组与套元数据；一步 LSLL 在选择后按批加载。
- 训练题从当前分组 / 套随机公式生成，通过 `algInverse.js` 求逆作为打乱。
- 训练页用一个连续页面选择分组、启动训练、计时和记录成绩；功能页之间不再提供跳转按钮。
- 训练成绩继续使用 `td_records_<puzzle>_<group>[_<cat>]`，计时规则与普通计时相同。
- 计时器通过回调接入下一步：计时页生成下一把 WCA 打乱，训练页生成下一道训练题。

### 求解器

- 候选生成：`generateCandidates()` 在指定动作族和长度内做双向 BFS，
  结果用块模型逐条复核；端点支持动作串、状态类别和 CubieCube。
- 完整解：`solveBetween(A, B)` 面向任意两个合法状态。先求相对状态
  `B⁻¹·A`，交给 `src/scramble/wca/puzzles/333/` 的二阶段求解器，
  再把解作用到 A 上复核。首次调用会建表（约 1–2 秒），之后复用。
- DR（Domino Reduction）：`solveToDR(A)` 复用二阶段 Phase 1，从启发式
  下界开始逐层加深，返回最短 DR 解和同长候选；判定标准是
  `twist / flip / slice` 全为 0，每条解都写回块模型复核。
- 三者职责分开：候选生成只回答“族内、限长能算出什么”；完整解不保证短，
  也不受动作族 / 筛选限制；DR 只负责到达 G1，不继续解完。
  `solver.html` 的“产出类型”用来切换。

### 蓝牙设备（M1）

- 入口：`index.html` 的 `#bluetoothModal`，装配在 `src/hardware/ui.js`。
- 连接：`session.connect()` 先 `requestDevice`，再按 primary service UUID
  交给 `registry.detectProfile()` 判定是 GAN 计时器还是 Gen2/3/4 魔方。
- 计时器：订阅 `fff5`，解析 0xFE 帧；状态变化经 `timer.external`
  驱动 ready / start / stop，不改键盘与触控路径。
- 魔方：MAC 解析链（手输 / 广播包 / 设备名 / 缓存）→ 倒序盐派生 AES key/iv
  → 解密通知 → `gan.js` 解码硬件 / 电量 / 面片 / 转动，汇总到 `session.cube`。
- 未连接时完全不介入计时；协议细节见 [`bluetooth.md`](./bluetooth.md)。

### 云端能力（暂缓，条件触发）

- 背景：会员制 + 服务端求解的可选分支，当前不做；求解能力保留在客户端。
- 请求链路：前端 → Worker API →（D1 配额 / R2 表）→ 二阶段求解 → 校验 →
  返回。算法复用 `src/scramble/wca/puzzles/333/`，Worker 只做协议、配额和校验。
- 免费层（计时、打乱、公式库、本地成绩、逆序解）保持匿名可用。
- 详细 API、表结构、阶段和合规前提见 [`cloud-plan.md`](./cloud-plan.md)。

## 不能碰的地方

- `LICENSE`、`licenses/`、`THIRD_PARTY_NOTICES.md` 中的授权记录。
- localStorage 既有 key 与字段语义。
- 统计规则、观察罚时规则（改动前必须确认）。
- cubing.js 失败时的本地兜底路径。
- `data/lsll-one-step/` 的按类拆分结构（会直接影响首屏体积）。
- 免费层能力（计时 / 打乱 / 公式库 / 本地成绩 / 逆序解）不因会员方案被限制。
- 客户端不打包新增的收费求解入口；现有本地打乱引擎保持原样。

## 常用命令

```powershell
# 本地静态服务（默认 8765，建议用 8903 避免冲突）
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8903

# 纯逻辑测试
node --test tests/*.test.mjs

# 蓝牙协议测试（不出现在测试真机，只验证解码）
node --test tests/hardware-*.test.mjs

# 静态检查（首次先 npm install）
npm run lint

# 刷新一步 LSLL 全量数据
node tools/fetch-lsll-full.mjs
node tools/fetch-lsll-full.mjs ap am f
```

## 术语

| 术语 | 含义 |
| --- | --- |
| WCA | World Cube Association，17 个官方项目 |
| eventId | WCA 事件 id，如 `333`、`pyra`、`sq1` |
| local | 本地打乱引擎 id，与 eventId 基本一致，金字塔为 `pyra` |
| mo3 / aoN | 3 次平均 / N 次去最好最差平均 |
| DNF / +2 | 未完成 / 加 2 秒罚时 |
| AUF | 顶层调整（Adjust U Face） |
| LSLL | Last Slot + Last Layer，最后一组 + 最后一层 |
| ZBLS / ZBLL | 最后一组入槽 / 最后一层公式集 |
| OLL / PLL | 顶层定向 / 顶层排列 |
| COLL / CMLL | 角块顶层定向（CFOP / 桥式变体） |
| F2L | 前两层 |
| PBL | 二阶顶层与底层同时排列 |
| L2C / L2E | 最后两个中心 / 最后两条棱 |
| CO / EO / CP / EP | 角定向 / 棱定向 / 角排列 / 棱排列 |
| CS / CSP | SQ1 形状 / 形状加配色 |
| OBL | SQ1 顶层与底层排列 |
