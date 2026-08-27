import { defineConfig } from "drizzle-kit"
import { Resource } from "sst"

export default defineConfig({
  out: "./_migrations/",
  schema: "./src/database/_drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: Resource.Database.host,
  },
})
