// @ts-check

import eslint from "@eslint/js"
import pt from "eslint-plugin-prettier/recommended"
import ts from "typescript-eslint"

export default ts.config(
  eslint.configs.recommended,
  ...ts.configs.recommended,
  pt,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-unused-expressions": "off",
      "no-undef": "off",
    },
  }
)
