import { initDb } from "./src/db/db"
import { defineConfig } from "kysely-ctl"

export default defineConfig({
  kysely: initDb(),
  migrations: {
    migrationFolder: "src/db/migrations",
  },
})
