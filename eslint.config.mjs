// 开发期静态检查配置。
// 只做正确性检查，不做格式化；不参与前端构建，也不改变 index.html 直接可跑的约束。
import js from "@eslint/js";
import globals from "globals";

const correctnessRules = {
    ...js.configs.recommended.rules,
    "no-unused-vars": [
        "error",
        {
            args: "after-used",
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrors: "none",
            ignoreRestSiblings: true,
        },
    ],
    "no-empty": ["error", { allowEmptyCatch: true }],
};

export default [
    {
        ignores: [
            "node_modules/**",
            "data/**",
            "licenses/**",
            // csTimer 的 4x4 求解器，第三方遗留代码，不参与本项目风格清理。
            "src/scramble/wca/puzzles/444/solver.js",
        ],
    },
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
            },
        },
        rules: correctnessRules,
    },
    {
        files: ["formulas.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
            },
        },
        rules: correctnessRules,
    },
    {
        files: ["tests/**/*.mjs", "tools/**/*.mjs", "eslint.config.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: correctnessRules,
    },
];
