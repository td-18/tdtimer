# AGENTS.md — TDtimer AI 协作入口

本文件是 TDtimer 的协作入口。通用习惯、流程和多 agent 规则在本地 AI 资料库
（私有，仅 AI 使用；位置见本机全局 AI 配置，不要写入公开文档）。

开工前：读本文件 → 读本地 AI 资料库的 `preferences.md` / `workflow.md` →
读 `docs/ai/architecture.md`；需要历史取舍时读 `docs/ai/decisions.md`。

## 一句话

现状是纯静态、无构建的 WCA 魔方计时器（HTML + CSS + 原生 ES Module），
部署在 Cloudflare Pages。账号、会员与服务端求解属于**暂缓的可选分支**
（见 `docs/ai/cloud-plan.md`），当前不做。用户是唯一决策者，AI 不自动提交
项目代码、不自动推送。

## 本项目硬性约束

- 不引入框架、打包器或构建步骤（前端），保持 `index.html` 直接可跑。
- 不新增 npm 运行时依赖；测试只用 `node --test`。
- 云端化落地前，前端继续满足"无构建、`index.html` 直接可跑"。
- 若启动商业化分支，收费求解能力放服务端；现有本地打乱引擎保持不变。
- 若做会员，不得限制免费层（计时、打乱、公式库、本地成绩、逆序解）。
- 只存账号必需的最小信息；用户未开启同步时不上传成绩明细。
- 若启动商业化分支，个人主体只走第三方平台代收，不自行接入微信 / 支付宝商户。
- 若启动商业化分支，上线前确认公式数据与第三方代码的商用授权（见 `cloud-plan.md`）。
- 不破坏 localStorage 既有 key 与数据结构（成绩、设置）。
- 不擅自修改计时 / 统计规则，规则问题先确认。
- 不删除或弱化 cubing.js CDN 的降级逻辑。
- 不删除第三方许可证与 `THIRD_PARTY_NOTICES.md` 记录。
- 项目代码不自动 `git commit` / `git push`，改完留在工作区。
- 多文件或较大改动，先列文件清单与影响范围，等确认再动手。
- 不做与任务无关的批量格式化、重命名或文件搬迁。

## 默认流程

读文档 → 定位文件 → 大改动先给方案 → 小步修改 → 按范围验证 → 汇报。

验证要求：

- 纯逻辑 / 数据：`node --test tests/*.test.mjs`
- 界面 / 交互 / 3D / 打乱：本地起服务并用浏览器实测，控制台无报错
  ```powershell
  powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8903
  ```

## 文档分层

| 内容 | 位置 |
| --- | --- |
| 通用习惯、流程、多 agent 规则 | 本地 AI 资料库（私有，仅 AI 使用） |
| 项目入口 | 本文件 |
| 技术栈、模块、数据流、边界、术语 | `docs/ai/architecture.md` |
| 项目决策记录 | `docs/ai/decisions.md` |
| 会员、服务端求解、云端架构规划（未实施） | `docs/ai/cloud-plan.md` |
| 公式缩略图细节 | `docs/formula-thumbnails.md` |
| 文档索引 | `docs/ai/README.md` |

通用规则不在本仓库复制，项目里只写本项目的事实和约束。

## 多 agent 协作

- 通用并发规则见资料库的 `workflow.md`，这里只补充项目要求。
- 共享文件（本文件、`README.md`、`docs/ai/*`）尽量由一个人最后统一改。
- 交接时给出：改动文件、验证结果、未完成项、下一步建议。

## 文档更新

- 通用习惯 / 流程：更新本地 AI 资料库（AI 可直接提交并推送，不要把地址写入本项目）。
- 项目架构、数据格式、验收路径：更新本仓库的 `docs/ai/`。
- 面向用户的能力变化：同步 README，但只写主要能力。
- 项目代码改动仍不自动提交、不自动推送。

> 如果本地还存在 `.opencode/agents/tdtimer.md`，它是同一套约定的本地副本；
> 内容冲突时以 `AGENTS.md`、AI 资料库和 `docs/ai/` 为准。
