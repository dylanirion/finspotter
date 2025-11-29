import config from "../../prettier.config.mjs"

/** @type {import('prettier').Config} */
const extendedConfig = {
  ...config,
  plugins: ["prettier-plugin-tailwindcss"],
}

export default extendedConfig
