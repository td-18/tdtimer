# 5x5 / 6x6 / 7x7 随机转动（M3）

## 文件

| 文件 | 内容 |
|---|---|
| `random.js` | 大魔方随机转动生成器、动作格式、同轴过滤 |
| `provider.js` | 共享 provider 工厂 |
| `../555/provider.js` | 5x5 provider |
| `../666/provider.js` | 6x6 provider |
| `../777/provider.js` | 7x7 provider |

## 规则

WCA 4b3e 允许 5x5/6x6/7x7 使用足够多的随机转动，而不是随机状态。

- 5x5：60 步，最多两层宽；
- 6x6：80 步，最多三层宽；
- 7x7：100 步，最多三层宽；
- 连续动作不能落在同一轴（U/D、R/L、F/B），减少冗余；
- 每步随机 1/2/3 个 90°，输出 `R`、`Rw`、`3Rw`、`R'`、`R2` 等。

## 5BLD

5BLD 复用 5x5 的打乱器，但 WCA 4b3a 还要求随机朝向。
当前 5x5 provider 收到 `randomOrientation` 时会返回 `DELEGATE_LEGACY`，
由 cubing.js 提供 oriented scramble。3BLD / 3Multi 也是同样处理。

## 实测

- 无表构建。
- 单次生成 < 1 ms。
- 5x5 / 6x6 / 7x7 分别固定 60 / 80 / 100 步。

## 限制

- 随机转动不是随机状态；这是 WCA 对 5x5/6x6/7x7 的明确例外。
- 4x4 暂不接管，仍走现有实现。
