// @ts-check
import rt from "eslint-plugin-react"
import rh from "eslint-plugin-react-hooks"
//import tw from "eslint-plugin-tailwindcss"

import baseConfig from "../../eslint.config.mjs"

const config = [
  ...baseConfig,
  //...tw.configs["flat/recommended"],
  rt.configs.flat?.recommended,
  rt.configs.flat?.["jsx-runtime"],
  {
    plugins: {
      rh: rh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
]

export default config
