// 筛选定义
//
// 与生成器分开：生成器只回答“这个动作族在这么长的范围内能算出什么”，
// 这里回答“算出来的东西收不收”。
//
// 允许出现的面、长度上下限这类约束放在这一层，而不是塞进生成器的动作集——
// 否则一收紧动作集，搜索深度也跟着掉，本来能算的解反而没了。

export const DEFAULT_FILTER = Object.freeze({
    allowedFaces: Object.freeze(["R", "U", "F", "L", "D"]),
    minLength: 0,
    maxLength: 30,
    requireVerified: true,
});

export function facesOf(movesText) {
    const faces = new Set();
    for (const token of String(movesText).trim().split(/\s+/)) {
        if (!token) continue;
        faces.add(token[0].toUpperCase());
    }
    return [...faces];
}

export function applyFilter(candidates, filter = DEFAULT_FILTER) {
    const allowedFaces = filter.allowedFaces ?? DEFAULT_FILTER.allowedFaces;
    const minLength = filter.minLength ?? DEFAULT_FILTER.minLength;
    const maxLength = filter.maxLength ?? DEFAULT_FILTER.maxLength;
    const requireVerified = filter.requireVerified ?? DEFAULT_FILTER.requireVerified;
    const allowed = new Set(allowedFaces.map((face) => String(face).toUpperCase()));

    const kept = [];
    const rejected = [];

    for (const row of candidates) {
        if (requireVerified && !row.verified) {
            rejected.push({ ...row, reason: "未通过校验" });
            continue;
        }
        const banned = facesOf(row.moves).filter((face) => !allowed.has(face));
        if (banned.length) {
            rejected.push({ ...row, reason: `含 ${banned.join("")}` });
            continue;
        }
        if (row.length < minLength || row.length > maxLength) {
            rejected.push({ ...row, reason: `长度 ${row.length}` });
            continue;
        }
        kept.push(row);
    }

    return { kept, rejected };
}
