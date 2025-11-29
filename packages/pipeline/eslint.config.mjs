// @ts-check
import p from "@pulumi/eslint-plugin"

//import tw from "eslint-plugin-tailwindcss"

import baseConfig from "../../eslint.config.mjs"

const config = [
  ...baseConfig,
  ...p,
]

export default config
