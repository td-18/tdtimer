// 5x5x5 本地 provider（M3）：随机转动 60 步，最多两层宽。

import { createBigCubeProvider } from "../bigcube/provider.js";

export function createFiveByFiveProvider() {
    return createBigCubeProvider("555");
}
