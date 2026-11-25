# Megaminx 本地生成器（M4）

## 文件

| 文件 | 内容 |
|---|---|
| `random.js` | 7 行 × (5 组 R/D + U/U') 的 Pochmann 随机转动 |
| `provider.js` | 随机转动 provider |

## 格式

标准 WCA Megaminx 打乱格式：

- 7 行；
- 每行 5 组 `R` / `D`，每组随机 `++` 或 `--`；
- 每行最后是 `U` 或 `U'`；
- 每行 11 个动作，共 77 步。

示例：

```text
R-- D++ R++ D++ R-- D-- R-- D++ R++ D++ U
R-- D++ R-- D++ R++ D++ R-- D-- R++ D++ U
...
```

## 规则

- WCA 4b3e 允许 Megaminx 使用足够多的随机转动，不要求随机状态。
- 记号只用 `R++`、`R--`、`D++`、`D--`、`U`、`U'`，
  与 `notation.js` 的 `MINX_RE` 一致。
- 计时器 UI 用 `puzzle="megaminx"` 展示。

## 实测

- 无表构建。
- 单次生成 < 1 ms。
- 固定 77 步。

## 限制

- 随机转动不是随机状态；这是 WCA 对 Megaminx 的明确例外。
