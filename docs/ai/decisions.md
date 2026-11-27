# 决策记录

只追加，不改写历史记录。每条写清背景、决定和影响，方便后来者理解“为什么”。

本文件只记录 TDtimer 专属决策。通用决策（建立资料库、AI 不自动提交、
习惯归纳授权等）见本地 AI 资料库的 `decisions.md`
（私有，仅 AI 使用；位置见本机全局 AI 配置，不要写入公开文档）。
早期通用决策保留为历史记录；最新范围以资料库为准。

格式：

```text
## YYYY-MM-DD 标题
- 状态：已采纳 / 已废弃
- 背景：
- 决定：
- 影响：
- 相关文件：
```

## 2026-11-25 MAC 自动解析与错误自愈

- 状态：已采纳
- 背景：手输 12 位 MAC 门槛高，用户通常只在魔方卡片 / 官方 App 里见过；
  Web Bluetooth 又不暴露适配器 MAC，而 GAN 密钥必须用 MAC 派生。
- 决定：按 `手输 > 广播包 > 设备名（仅完整 12 位）> 本地缓存` 解析。
  广播监听必须在 `gatt.connect()` 之前启动（连上后设备通常不再广播）；
  首次解码成功后才写缓存，避免错误 MAC 被记住；
  连续 40 帧解不出事件且地址来自缓存 / 设备名时，清掉该设备缓存并提示重输。
- 影响：`requestDevice` 增加 `optionalManufacturerData`（CIC `0x??01` 全段）；
  拿不到广播数据的平台会静默回落到下一级，不阻塞连接；仍然全程本地处理，
  MAC 不上传服务端。
- 相关文件：`src/hardware/transport.js`、`mac.js`、`registry.js`、`session.js`、
  `ui.js`、`docs/ai/bluetooth.md`。

## 2026-11-25 蓝牙 M1：GAN 计时器闭环 + 手输 MAC

- 状态：已采纳（M1，分支 `蓝牙尝试`，验证后合入）
- 背景：智能魔方 / 计时器资料已核对，需要最小可用版本验证协议与交互；
  Web Bluetooth 拿不到设备 MAC，而 GAN 魔方密钥必须用 MAC 参与派生。
- 决定：
  - M1 先打通 GAN 智能计时器（只读 `fff5`，无密钥），同时把手输 MAC 的
    GAN 魔方连通探测做出来；广播包反推 MAC 留到 M2。
  - 继续零依赖：协议改写为原生 ES Module，AES 用同步实现，避开
    WebCrypto 异步队列导致的通知乱序。
  - 计时器连上即接管（手放上 ready / 手离开开始 / 停止帧停表），
    但仍只调用新加的 `timer.external` 钩子，键盘与触控路径不变。
  - 成绩时间继续取本机 `performance.now()`，设备上报时间只显示；
    改用设备时间属于计时规则变更，需要单独确认。
- 影响：新增 `src/hardware/` 与蓝牙弹窗；不连接时行为与原来一致；
  新增 `localStorage["td_hw_mac_v1"]`，不影响既有成绩 / 设置 key。
  未做真机联调，帧格式以公开实现和源码核对为准。
- 相关文件：`src/hardware/*`、`src/timer.js`、`src/main.js`、`index.html`、
  `styles.css`、`tests/hardware-*.test.mjs`、`docs/ai/bluetooth.md`、
  `THIRD_PARTY_NOTICES.md`。

## 2026-11-25 引入 ESLint 开发期检查

- 状态：已采纳
- 背景：手写模块多，语法、拼写和未用变量目前靠人工检查；`node --test`
  只覆盖纯逻辑，不覆盖静态错误。试扫时核心 `src/` 只有 3 个 warning，
  第三方 444 求解器有 124 个历史错误。
- 决定：新增 ESLint 10 flat config 和 `npm run lint`，只检查 `src/`、
  `tests/`、`tools/`；忽略 `data/`、`licenses/` 和 444 求解器；只开
  正确性规则，不做格式化；不接入构建或部署。
- 影响：新增开发依赖和 `package-lock.json`，前端仍无构建；Cloudflare Pages
  需确认构建命令为空，避免根 `package.json` 触发自动构建。
- 相关文件：`package.json`、`eslint.config.mjs`、`.gitignore`、`README.md`、
  `docs/ai/architecture.md`。

## 2026-11-24 建立 AI 文档库

- 状态：已采纳
- 背景：项目会更换模型、也可能多个 agent 并行；约定只存在于对话和本地
  agent 配置里，换环境就丢，容易各改各的。
- 决定：在仓库内建立 `AGENTS.md` + `docs/ai/` 作为单一入口；区分
  “已确认 / 证据 / 待确认”，决策单独记录。
- 影响：新 agent 先读入口；共享文档改动需要说明；文档成为验收的一部分。
- 相关文件：`AGENTS.md`、`docs/ai/*`、`CLAUDE.md`。

## 2026-11-24 README 功能精简

- 状态：已采纳
- 背景：Gitee / GitHub 首页的“功能”一节堆了大量实现细节，主要能力反而不突出。
- 决定：README 只保留计时统计、WCA 全项目、公式库、状态缩略图、LSLL 训练
  五条主要能力；分类和缩略图细节移到 `docs/formula-thumbnails.md`，
  数据生成说明放进“开发”。
- 影响：首页更短；细节仍有归属，不再往 README 回堆。
- 相关文件：`README.md`、`docs/formula-thumbnails.md`。

## 2026-11-24 AI 不自动提交与推送

- 状态：已采纳
- 背景：推送会触发 Cloudflare Pages 自动部署，等于直接上线；需要用户把关。
- 决定：AI 只改工作区文件，不执行 `git commit` / `git push`；多文件或较大
  改动先列文件清单和影响范围，确认后再改。
- 影响：交付以“可检查的改动”为单位，而不是“已提交的结果”。
- 相关文件：`AGENTS.md`、`docs/ai/preferences.md`、`docs/ai/workflow.md`。

## 2026-11-24 通用文档迁出到独立资料库

- 状态：已采纳
- 背景：通用习惯和流程与项目内容混在一起，换项目要复制，容易出现多份
  不一致的副本。
- 决定：AI 资料库独立成私有仓库，所有项目共用；TDtimer 只保留
  `AGENTS.md`、`docs/ai/architecture.md`、`docs/ai/decisions.md`，
  以及两份指向资料库的迁移入口。资料库地址只放在本机全局 AI 配置中，
  不写入本项目公开文档。
- 影响：通用规则只维护一处；项目文档聚焦本项目的事实、数据格式和验收路径。
  项目代码仍不自动提交、不自动推送；资料库文档由 AI 直接维护并推送。
- 相关文件：`AGENTS.md`、`docs/ai/README.md`、`docs/ai/preferences.md`、
  `docs/ai/workflow.md`、`README.md`。

## 2026-11-24 引入会员与云端求解（暂缓）

- 状态：暂缓（条件触发），未实施
- 背景：本地求解器已能跑，但"登录后才能用"在客户端不成立；同时希望探索
  会员制变现，并给云同步留接口。
- 决定：规划静态前端 + Worker API 的架构；求解器只在服务端运行；免费层
  （计时、打乱、公式库、本地成绩、逆序解）保持完整。方案见
  [`cloud-plan.md`](./cloud-plan.md)。
- 影响：项目从"纯静态"变成"静态前端 + 后端服务"，需要长期运维；在阶段 1
  落地前，代码仍按纯静态约束开发。
- 相关文件：`AGENTS.md`、`docs/ai/cloud-plan.md`、`docs/ai/architecture.md`。

## 2026-11-24 个人主体走平台代收 + 激活码（暂缓）

- 状态：暂缓（条件触发），未实施
- 背景：个人主体不能直接做经营性互联网信息服务；微信 / 支付宝商户通常要求
  备案域名和企业主体。
- 决定：阶段 1 用第三方平台代收（爱发电 / 小报童等），本站只做兑换码校验和
  权益发放，不自建支付和商户号。
- 影响：上线快、验证成本低；但接受平台抽成、结算周期和封号风险。注册公司
  后再评估是否切换到自建支付。
- 相关文件：`docs/ai/cloud-plan.md`。

## 2026-11-24 客户端不打包求解器（暂缓）

- 状态：暂缓（条件触发），未实施
- 背景：客户端的代码和表一旦下发就能被保存、转发，登录门禁只能防君子。
- 决定：新增的收费求解入口放服务端，表放 R2，客户端只调 API；现有本地打乱
  引擎（含随机状态求解）保持不变。
- 影响：离线不能使用收费求解；服务端成为该功能的必需依赖；算力成本按公开
  计费可以忽略。注意 `src/scramble/wca/puzzles/333/` 已经是公开的完整求解器，
  所以服务端化只能降低滥用，不能绝对防白嫖；付费价值要放在配额、同步和
  训练数据上。
- 相关文件：`docs/ai/cloud-plan.md`、`src/scramble/wca/puzzles/333/`。

## 2026-11-24 免费层不因会员缩水（暂缓）

- 状态：暂缓（条件触发），未实施
- 背景：现有用户习惯"打开就能用"，收费功能如果挤占基础能力，会直接流失。
- 决定：计时、打乱、公式库、本地成绩、逆序解永远免费且免登录；会员只卖
  "更短解、更高配额、云同步、导出"。
- 影响：会员价值必须靠增量能力支撑，不能靠阉割；上线后要观察免费用户留存。
- 相关文件：`docs/ai/cloud-plan.md`。

## 2026-11-24 商业化前补齐第三方授权（暂缓）

- 状态：暂缓（条件触发），未实施
- 背景：项目以 GPL-3.0-only 分发；CubeRoot / 魔方根公式数据目前只有口头
  公开许可，4x4 求解器来自 csTimer（GPLv3）。
- 决定：收费上线前补齐公式数据的书面商用授权；服务端代码不引入 AGPL 依赖；
  前端源码继续公开。
- 影响：授权是上线前置条件，不是上线后补；未补齐前只能保持免费。
- 相关文件：`THIRD_PARTY_NOTICES.md`、`README.md`、`docs/ai/cloud-plan.md`。

## 2026-11-24 任意起止复用二阶段完整解

- 背景：公式候选生成只在动作族和长度内做双向 BFS，两个相距较远的状态
  （例如两条 20 步打乱）在限长内本来就不相交，不能算“任意起止”。
- 决定：新增 `src/solver/complete.js`，把任意 A→B 转成相对状态 `B⁻¹·A`，
  复用 `src/scramble/wca/puzzles/333/` 的二阶段求解器，再用块模型复核。
  候选生成与完整解分开：前者保持族内、限长；后者不保证短，也不受筛选限制。
- 影响：`solver.html` 增加“产出类型”切换；二阶段表首次调用才构建，
  约 1–2 秒、约 10 MB，之后复用。
- 相关文件：`src/solver/complete.js`、`src/solver/index.js`、`solver.html`、
  `docs/ai/architecture.md`。

## 2026-11-24 先做 DR 完整求解

- 背景：FMC 流程先要把任意状态降到 DR（Domino Reduction / G1），
  之后再在 `<U, D, R2, L2, F2, B2>` 内求解；直接复用完整解不够用。
- 决定：新增 `src/solver/dr.js`，复用二阶段 Phase 1，从启发式下界逐层加深，
  返回最短 DR 解和同长候选。DR 判定用 `twist / flip / slice` 全 0，
  每条候选都写回块模型复核。上限 13 步，节点 / 时间预算可调。
- 影响：`solver.html` 的“产出类型”增加 DR 模式；DR 模式只读取起点，
  不使用目标状态。完整解与 DR 解分开，不把“到 DR”误当成“已解完”。
- 相关文件：`src/solver/dr.js`、`src/solver/index.js`、
  `src/scramble/wca/puzzles/333/search.js`、`solver.html`、
  `docs/ai/architecture.md`。

## 2026-11-28 三模块入口与 3D 异步降级

- 状态：已采纳
- 背景：单页入口会同时加载公式数据、计时、蓝牙和 cubing.js；实测 CDN 延迟
  2 秒会把首屏可用时间从约 3 秒拉到约 6.7 秒，持续卡住时页面超过 13 秒仍为空白。
- 决定：拆成首页、计时、公式、训练四个静态页面；首页只保留纯 SVG 六面展开图，
  不依赖 cubing.js。三个功能页使用普通链接互相跳转，进入后才加载对应数据。
  训练页复用现有分组 / 套训练、计时与成绩规则，不再加载 WCA worker。
  `twisty-player` 统一异步加载并设置 5 秒超时；失败时显示平面状态图与降级提示。
- 影响：首页和计时页不再请求公式数据；公式页不再加载计时、成绩或蓝牙；训练页
  不再加载本地 WCA 打乱模块。计时器改为通过 `onStart` / `onStop` 回调接入普通
  打乱或训练题生成，统计和 localStorage key 不变。
- 相关文件：`index.html`、`timer.html`、`formula.html`、`training.html`、
  `src/timer-entry.js`、`src/formula-entry.js`、`src/training-entry.js`、
  `src/training.js`、`src/twistyView.js`、`src/loadGuard.js`、`src/timer.js`、
  `src/formula.js`、`src/scramble.js`、`src/lsllLoader.js`。

## 2026-11-28 取消模块互跳与 3D 状态图

- 状态：已采纳
- 背景：三个模块入口已经由首页负责，功能页内部再放互相跳转按钮会重复导航；
  cubing.js 3D 在部分网络环境下无法显示，用户看到的打乱状态区域会为空。
- 决定：首页只保留计时、公式、训练三个入口板块；计时、公式、训练页不提供互相跳转
  按钮。所有可见魔方状态改为本地平面图，不再创建或加载 `twisty-player`。
  2x2–7x7 使用完整六面展开图，按实际打乱或公式状态更新六个面。
- 影响：计时和训练当前打乱会完整显示 U/L/F/R/B/D；公式卡和详情统一使用平面状态。
  cubing.js 只保留部分非本地项目的打乱兜底和 SQ1 状态计算，不再影响 3D 展示可用性。
- 相关文件：`index.html`、`timer.html`、`formula.html`、`training.html`、
  `src/cubeThumb.js`、`src/flatCubeView.js`、`src/scramble.js`、`src/training.js`、
  `src/formula.js`、`src/timer-entry.js`、`src/training-entry.js`、`styles.css`。

## 2026-11-28 公式库恢复 3D 并修正高阶宽层平面状态

- 状态：已采纳，替代上一条中“公式页也取消 3D”的部分。
- 背景：计时页的 3D 会因 CDN 不可用而空白，但公式库原本的异步 3D 仍有价值；
  同时 6×6 / 7×7 的 `3Rw` 等三层宽转被错误当成从第 3 层开始。
- 决定：计时和训练继续使用完整六面平面图；公式库恢复原有 3D 状态和平面降级。
  宽层记号中的数字统一表示从外层开始包含的层数，`3Rw` 必须作用于外三层；
  `3R`（无 w）仍表示第 3 个单层。
- 影响：6×6 / 7×7 的平面状态与宽层打乱一致；公式库重新异步加载
  `twisty-player`，失败时仍显示平面图，不影响页面入口。
- 相关文件：`src/cubeThumb.js`、`src/formula.js`、`src/twistyView.js`、
  `tests/cube-net.test.mjs`、`styles.css`、`README.md`、`docs/ai/architecture.md`。
