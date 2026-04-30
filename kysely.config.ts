import { Database } from "bun:sqlite"

import { BunSqliteDialect } from "kysely-bun-sqlite"
import { defineConfig } from "kysely-ctl"

import { getDbPath, ensureDbDir } from "./src/db/path"

ensureDbDir()

const db = new Database(getDbPath())
db.run("PRAGMA journal_mode = WAL")
db.run("PRAGMA foreign_keys = ON")

export default defineConfig({
  dialect: new BunSqliteDialect({
    database: db,
  }),
  migrations: {
    migrationFolder: "src/db/migrations",
  },
})
