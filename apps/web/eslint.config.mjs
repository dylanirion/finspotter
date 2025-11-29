// @ts-check
import { FlatCompat } from "@eslint/eslintrc"
import rq from "@tanstack/eslint-plugin-query"

//import tw from "eslint-plugin-tailwindcss"

import baseConfig from "../../eslint.config.mjs"

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

const config = [
  ...baseConfig,
  //...tw.configs["flat/recommended"],
  ...rq.configs["flat/recommended"],
  ...compat.extends("next", "next/core-web-vitals", "prettier"),
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
]

export default config
