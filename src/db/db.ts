import { Database } from "bun:sqlite"

import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"

import { getDbPath, ensureDbDir } from "./path"
import type { DB } from "./types"

ensureDbDir()

const bunDb = new Database(getDbPath())
bunDb.run("PRAGMA journal_mode = WAL")
bunDb.run("PRAGMA foreign_keys = ON")

export const db = new Kysely<DB>({
  dialect: new BunSqliteDialect({
    database: bunDb,
  }),
})

export async function migrateToLatest(): Promise<void> {
  const { runMigrations } = await import("./migrate")
  await runMigrations()
}
