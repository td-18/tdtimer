# 打乱 provider 按需加载 + 预取重排

分支：`feat/lazy-providers-prefetch`（基于 `main`，不改动 `main`）
目的：首条打乱不再为「没在玩的项目」付下载成本；下一把打乱的预取挪到计时期间。

## 改了什么

### 1. provider 注册从「静态全量」改为「按需加载」

`src/scramble/wca/puzzles/index.js` 原先静态 `import` 11 个项目实现，worker 一启动就下载全部：

| | 改前 | 改后 |
|---|---|---|
| worker 静态模块图 | 35 个文件 / **381.1KB** | 7 个文件 / **39.5KB** |
| 首条打乱前需下载 | 381KB（含 4x4 的 206.5KB） | ~40KB + 当前项目（333 约 40KB） |

做法：登记表只保留 `id + algorithm + 动态 import 加载器`，用惰性代理对象注册：

- `registerBuiltinProviders()` 仍是**同步**的（worker 顶层调用、测试都依赖这一点）；
- 代理对象同步暴露 `meta.algorithm`，所以 `capabilities` 查询不需要加载实现体
  （实测：capabilities 21ms 返回，333/444 均未加载）；
- 实现体加载完成后，`meta` 换成 provider 的**真实 meta 对象本体**（不是拷贝，
  因为 provider 会在 `init` 里回写 `tableBuildMs`）；
- 加载失败会把缓存的 Promise 清掉，下次请求可重试。

新增导出：`preloadBuiltinProvider(id)`、`isBuiltinProviderLoaded(id)`、`listBuiltinProviderIds()`。

### 2. 项目被选中即只加载该项目

`src/timer-entry.js`：切换项目时调用 `preloadLocalProvider(puzzle)` →
`ScrambleService.init(eventId)` → worker 内 `import()` 该项目 + 建表，不生成打乱。

### 3. 预取从「生成完就打」挪到「计时期间」

- `src/scramble.js`：去掉 `genScr()` 里的 `prefetchLocal(puzzle)`，新增导出
  `prefetchNextScramble()`；
- `src/timer-entry.js`：通过 `initTimer({ onStart, onStop })` 把计时页的回调
  接到 `prefetchNextScramble()` 和 `genScr()`；`src/timer.js` 本身不再依赖打乱模块。

效果：准备阶段不再有后台请求抢带宽/主线程；用户解完停表时 `genScr()` 命中
`localPrefetch` 缓存，下一把是瞬时的。

## 验证

```
node --test tests/      → 82 通过 / 0 失败（原 78 + 新增 4）
npx eslint .            → 无告警
```

新增 `tests/wca-lazy-providers.test.mjs` 覆盖：注册后可同步读 algorithm 且不加载实现体、
生成 333 只加载 333、预热只加载指定项目、加载失败可重试。

worker 消息链路模拟（Node 内 stub `self`）：

```
capabilities 21ms，333/444 均未加载
333 首条打乱 OK 1742ms → 加载状态：333=true 444=false
444 首条打乱 OK 1438ms → 444=true
切回 333 再生成 113ms（建表结果已被 provider 缓存）
```

## 回退

三条路，任选：

```bash
git switch main                       # 不带走这个分支的改动
git revert <commit>                   # 在分支上反向提交
git branch -D feat/lazy-providers-prefetch   # 直接丢弃本地分支
```

改动只涉及 4 个源文件 + 1 个新测试，无配置/数据变更，回退不需要迁移：
`src/scramble/wca/puzzles/index.js`、`src/scramble.js`、`src/timer.js`、
`src/timer-entry.js`。

## 已知取舍

- 首次切到某个**没加载过**的项目，会多一次模块请求（该项目的 provider 文件，几十 KB）；
  因为「选中即预热」，这次请求发生在用户选项目、还没按开始的时候，不落在计时路径上。
- `meta.lazy = true` / `meta.loaded = true` 两个标记会出现在 capabilities 的 meta 里，
  便于线上排查"这个项目到底加载了没"，不影响现有字段。
