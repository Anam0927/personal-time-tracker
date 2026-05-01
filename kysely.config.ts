import { defineConfig } from "kysely-ctl"

import { initDb } from "@/lib/db/db"

export default defineConfig({
  kysely: initDb(),
  migrations: {
    migrationFolder: "src/lib/db/migrations",
  },
})
