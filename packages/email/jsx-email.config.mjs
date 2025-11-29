/** @type {import('jsx-email/config').JsxEmailConfig} */
import { defineConfig } from "jsx-email/config"

export const config = defineConfig({
  render: {
    minify: true,
    inlineCss: true,
  },
})
