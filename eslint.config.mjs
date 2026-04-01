import js from "@eslint/js";
import nPlugin from "eslint-plugin-n";
import prettierPlugin from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  nPlugin.configs["flat/recommended-script"],
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-console": "warn",
      "n/no-unsupported-features/es-syntax": "off",
    },
  },
  prettierPlugin,
];
