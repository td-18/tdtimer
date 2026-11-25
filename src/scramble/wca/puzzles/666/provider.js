// 6x6x6 本地 provider（M3）：随机转动 80 步，最多三层宽。

import { createBigCubeProvider } from "../bigcube/provider.js";

export function createSixBySixProvider() {
    return createBigCubeProvider("666");
}
