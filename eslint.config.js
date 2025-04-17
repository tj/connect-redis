import js from "@eslint/js"
import prettier from "eslint-plugin-prettier/recommended"
import ts from "typescript-eslint"

export default ts.config({
  extends: [js.configs.recommended, ...ts.configs.recommended, prettier],
  rules: {
    "prefer-const": 0,
    eqeqeq: [2, "smart"],
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
  },
  ignores: ["dist/**"],
})
