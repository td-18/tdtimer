# Third-Party Notices / 第三方声明

TDtimer 以 **GPL-3.0-only** 分发。完整许可证见根目录 `LICENSE`。

本项目包含或运行时使用以下第三方作品。各作品的版权归其作者所有。

## csTimer

- 来源：https://github.com/cs0x7f/cstimer
- 许可：GNU General Public License v3.0（GPLv3）
- 使用位置：
  - `src/scramble/wca/puzzles/444/solver.js`
- 说明：
  - `solver.js` 是 csTimer 中 `isaac.js`、`min2phase.js`、`mathlib.js`、
    `scramble_333_edit.js`、`scramble_444.js` 的离线拼接版本。
  - 本地修改仅包括：模块化 shim、初始化进度回调、导出适配；
    求解算法本身未修改。
  - 对应源码可从上述仓库获取；本项目也随附完整 `solver.js`。

## gan-web-bluetooth

- 来源：https://github.com/afedotov/gan-web-bluetooth
- 作者：Andy Fedotov
- 许可：MIT
- 使用位置：
  - `src/hardware/protocols/gan.js`（Gen2 / Gen3 / Gen4 协议与密钥常量）
  - `src/hardware/protocols/gan-timer.js`（计时器帧与 CRC）
- 说明：
  - 按 MIT 许可改写为原生 ES Module：移除 RxJS、去掉异步驱动，
    把事件解析改为纯函数；帧格式、位偏移、CRC 覆盖范围与密钥派生方式
    与该库保持一致。
  - GAN Gen2-4 的 AES 密钥基底属于互操作性常量，由社区逆向得到，
    仅用于与设备通讯；集中放在 `gan.js` 顶部，便于日后替换。
  - 对应源码可从上述仓库获取。

## min2phase

- 来源：https://github.com/cs0x7f/min2phase
- 作者：Shuang Chen
- 许可：GPLv3 或 MIT（双许可）
- 使用位置：`puzzles/444/solver.js` 内的 3x3 求解阶段。
- 说明：本项目整体按 GPLv3 分发；min2phase 的 MIT 选项不改变
  csTimer 部分的 GPLv3 义务。

## cubing.js

- 来源：https://github.com/cubing/cubing.js
- 许可：MPL-2.0 OR GPL-3.0-or-later
- 使用方式：
  - `index.html` 和 `src/scramble.js` 从 `https://cdn.cubing.net/v0/` 动态加载；
  - M5 离线打包如果内置 cubing.js，需要保留其许可证和版权声明，
    并按所选许可履行源码提供义务。
- 说明：本项目整体选择 GPLv3，与 cubing.js 的 GPL-3.0-or-later 选项兼容。

## three.js

- 来源：https://threejs.org/
- 许可：MIT
- 使用方式：cubing.js 的依赖；当前通过 cubing.js CDN 间接加载。
- 如果离线打包 cubing.js，需要同时保留 three.js 的 MIT 声明。

## Cubing Icons（WCA 官方项目图标）

- 来源：https://github.com/cubing/icons / https://icons.cubing.net
- 版权：Copyright (c) 2015 Devin Corr-Robinett
- 许可：MIT
- 使用方式：`index.html` 从 `https://cdn.cubing.net/v0/css/@cubing/icons/css`
  加载图标字体；公式库顶部切换按钮和项目选择卡片使用其中的
  WCA 官方比赛项目平面图标（`event-333`、`event-222` 等）。
- 说明：该图标集与 WCA 官网使用的项目图标一致。MIT 许可允许随项目分发；
  如果后续改为离线内置，需要保留上述版权与许可声明。

## CubeRoot 公式数据

- 来源：https://cuberoot.me / `https://api.cuberoot.me`
- 数据位置：`data/cuberoot.js`、`data/lsll.js`、`data/lsll-one-step/*.js`
- 生成脚本：`tools/fetch-cuberoot.ps1`、`tools/fetch-lsll.ps1`
- LSLL 说明：
  - 两步列表由 ZBLS 第一眼公式和 ZBLL/PLL 第二眼公式组成；
  - 一步列表为全量 579,368 条最优解，按 41 个大类拆分存放；
  - 每条一步公式取 CubeRoot `/v1/alg/lsll/case/:key` 的最优解；
    后端尚未回填的大类，按镜像对称从已计算的对侧大类生成；
  - 一步大类卡片的 LS 状态 facelets 按 CubeRoot `categoryCardFacelets` 的规则生成；
  - `tools/lsll-zbls-keys.json` 是 CubeRoot 开源的 ZBLS/LSLL case 对应表
    （`core/packages/client/lib/lsll/zbls_algs.json`），用于两步列表和 case 定位。
- 授权状态：
  - 项目作者已向魔方根（CubeRoot）说明用途并取得公开公式数据的许可；
  - 书面许可文件待补，后续放入 `licenses/` 或本文件附录；
  - 书面许可需要明确允许在 GPLv3 下再分发；如果许可范围不兼容，
    需要把该数据拆成单独许可或替换；
  - 在书面文件补齐前，保留此说明和来源标注。
- 说明：`data/cuberoot.js` 是从 CubeRoot API 导入的公式数据；
  `formulas.js` 中另有项目作者手工校对的公式。

## TNoodle

- 来源：https://github.com/thewca/tnoodle
- 许可：GPLv3
- 使用方式：当前仅作为规则/算法参考，未直接随包分发 TNoodle 代码。
- 如果后续接入 TNoodle 代码，需要补充对应的 GPLv3 声明和源码说明。

## 其他

- `data/cuberoot.js`、`formulas.js` 中的公式文本可能包含第三方作者提交的算法；
  如后续发现需要单独署名的来源，请补充到本文件。

## 项目版权

Copyright (C) 2026 TDtimer contributors.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <https://www.gnu.org/licenses/>.
