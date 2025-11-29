import { defineConfig } from "drizzle-kit"
import { Resource } from "sst"

export default defineConfig({
  out: "./_migrations/",
  schema: "./src/database/_drizzle/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${Resource.Database.user}:${Resource.Database.password}@${Resource.Database.host}:${Resource.Database.port}/${Resource.Database.database}`,
  },
})
