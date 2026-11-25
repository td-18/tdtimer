// 7x7x7 本地 provider（M3）：随机转动 100 步，最多三层宽。

import { createBigCubeProvider } from "../bigcube/provider.js";

export function createSevenBySevenProvider() {
    return createBigCubeProvider("777");
}
