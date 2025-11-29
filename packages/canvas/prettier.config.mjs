import config from "../../prettier.config.mjs"

/** @type {import('prettier').Config} */
const extendedConfig = {
  ...config,
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
}
export default extendedConfig
