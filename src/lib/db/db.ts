import { Database } from "bun:sqlite"

import { CamelCasePlugin, Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"

import { getDbPath, ensureDbDir } from "./path"
import type { DB } from "./types"

let _db: Kysely<DB> | null = null

export function initDb(): Kysely<DB> {
  if (_db) return _db

  ensureDbDir()
  const bunDb = new Database(getDbPath())
  bunDb.run("PRAGMA journal_mode = WAL")
  bunDb.run("PRAGMA foreign_keys = ON")

  _db = new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: bunDb,
    }),
    plugins: [new CamelCasePlugin()],
  })

  return _db
}

export async function migrateToLatest(): Promise<void> {
  const { runMigrations } = await import("./migrate")
  await runMigrations()
}
