import { defineConfig } from "kysely-ctl"

import { initDb } from "./src/db/db"

export default defineConfig({
  kysely: initDb(),
  migrations: {
    migrationFolder: "src/db/migrations",
  },
})
