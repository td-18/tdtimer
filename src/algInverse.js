export function invertAlg(alg) {
    return String(alg || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .reverse()
        .map((token) => {
            if (token === "/") return "/";
            const pair = token.match(/^\((-?\d+),(-?\d+)\)$/);
            if (pair) return `(${-Number(pair[1])},${-Number(pair[2])})`;
            if (token.endsWith("++")) return token.slice(0, -2) + "--";
            if (token.endsWith("--")) return token.slice(0, -2) + "++";
            if (token.endsWith("2'")) return token.slice(0, -1);
            if (token.endsWith("'")) return token.slice(0, -1);
            if (token.endsWith("2")) return token;
            return token + "'";
        })
        .join(" ");
}
