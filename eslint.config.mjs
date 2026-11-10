import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * Lint 配置（Astro 迁移后不再依赖 eslint-config-next）。
 *
 * 规则分层：
 * - 浏览器端 React 组件（components/）按 hooks 与 a11y 推荐集检查；
 * - 微信小程序与测试辅助代码沿用 any 驱动的宿主 API，放宽 no-explicit-any；
 * - public/sw.js 是 Service Worker 脚本，单独声明运行环境全局量。
 */
const relaxedTypeRules = {
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/ban-ts-comment": "off",
  "@typescript-eslint/no-empty-object-type": "off",
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

export default defineConfig([
  {
    ignores: [
      "dist/**",
      ".astro/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "miniprogram/generated/**",
      "desktop/**",
      "content/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // DESIGN.md 把指板与 TAB 区域定义为可聚焦容器（Enter 切弦、Space 播放），
      // 聚焦能力由键盘处理器配套提供，因此允许非交互元素带 tabIndex。
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  {
    files: ["tests/**/*.ts", "miniprogram/**/*.ts"],
    rules: relaxedTypeRules,
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // 测试会刻意写出连续空格与组合字符的正则，用来锁定真实排版输出。
      "no-regex-spaces": "off",
      "no-misleading-character-class": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.mjs", "astro.config.mjs", "postcss.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
]);
