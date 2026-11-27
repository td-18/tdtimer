# TDtimer

一个支持 WCA 全项目的本地打乱计时器。

## 功能

- **三模块入口**：首页只保留 `计时`、`公式`、`训练` 三个入口板块；
  三个功能页独立加载，进入后才加载对应数据。蓝牙与设置只在计时页。
- **计时与统计**：15 秒观察、单次 / mo3 / ao5 / ao12 / ao50 / ao100，
  成绩历史支持 +2、DNF 和删除。
- **WCA 全项目**：覆盖 17 个官方项目，打乱在本地 worker 中生成
  （3x3–7x7、金字塔、斜转、魔表、SQ1、五魔方），cubing.js 负责兜底打乱和
  部分非本地项目的兜底打乱。状态图使用本地六面平面展开图，不再加载 3D。
- **公式库**：CubeRoot 公式覆盖三阶 / 二阶 / 四阶 / 五阶 / 六阶 / FTO /
  五魔方 / 金字塔 / 斜转 / SQ1。统一按「状态 → 公式」浏览，点状态看公式和
  完整平面状态；三阶 / 二阶支持家族二级分类，状态卡进入视口才渲染。
  盲拧、魔表、单手暂不接入。
- **状态缩略图**：立方体状态统一显示完整六面平面展开图，
  SQ1 使用自绘平面图。绘制细节见
  [`docs/formula-thumbnails.md`](./docs/formula-thumbnails.md)。
- **公式训练**：独立训练页复用现有分组与套训练；一步 LSLL（579,368 条
  最优解）和两步（ZBLS + ZBLL/PLL）均可选择，公式按需加载。

## 开发

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8903
# 打开 http://127.0.0.1:8903/index.html
```

安装开发依赖并做静态检查（仅开发期，不影响 `index.html` 直接运行）：

```bash
npm install
npm run lint
```

静态检查需要 Node 20.19+（22.13+ 或 24+）。

纯逻辑测试：

```bash
node --test tests/*.test.mjs
```

刷新一步 LSLL 全量数据（从 CubeRoot case API 拉取，按镜像补齐未回填大类）：

```bash
node tools/fetch-lsll-full.mjs
# 只重建指定大类
node tools/fetch-lsll-full.mjs ap am f
```

两步 LSLL 数据和分类元数据由 `tools/fetch-lsll.ps1` 生成；一步大类文件从
CubeRoot case API 生成并随仓库提供，每类单独存放，避免首屏加载全部公式。

## 目录

```text
index.html    三模块首页（无外部脚本，纯 SVG 平面展开图）
timer.html    计时页
formula.html  公式浏览页
training.html 公式训练页
src/          模块入口、页面逻辑与本地打乱求解器
data/         公式数据（data/lsll-one-step/ 为一步 LSLL 的 41 个大类文件）
docs/         分类与缩略图细节、项目 AI 文档（docs/ai/）
tests/        Node 测试
tools/        本地静态服务器和浏览器冒烟页
```

AI / 多 agent 协作约定见 [`AGENTS.md`](./AGENTS.md)，
项目专属文档在 [`docs/ai/`](./docs/ai/README.md)。

## 许可

本项目以 **GPL-3.0-only** 分发。完整许可证见 [`LICENSE`](./LICENSE)。

第三方组件、来源和授权状态见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

特别注意：

- 4x4 求解器来自 csTimer（GPLv3）。
- cubing.js 通过 CDN 动态加载（MPL-2.0 OR GPL-3.0-or-later）。
- CubeRoot / 魔方根公式数据已获得口头公开许可，书面许可待补。

Copyright (C) 2026 TDtimer contributors.
