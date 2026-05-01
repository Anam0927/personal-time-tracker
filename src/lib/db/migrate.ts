import { promises as fs } from "node:fs"
import path from "node:path"

import { Migrator, FileMigrationProvider } from "kysely"

import { initDb } from "./db"

export async function runMigrations() {
  const db = initDb()

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(import.meta.dirname, "migrations"),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`✅ Migration "${it.migrationName}" executed`)
    } else if (it.status === "Error") {
      console.error(`❌ Migration "${it.migrationName}" failed`)
    }
  })

  if (error) {
    console.error("Migration failed:", error)
    throw error
  }

  return results
}
