import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { Kysely } from "kysely"

import type { DB } from "@/db/types"

export interface TestContext {
  db: Kysely<DB>
  cleanup: () => void
  testDir: string
}

export async function createTestDb(): Promise<TestContext> {
  const testDir = path.join(
    os.tmpdir(),
    `time-tracker-repo-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  )

  const { mock } = await import("bun:test")
  mock.module("xdg-basedir", () => ({ xdgData: testDir }))

  const migrateModule = await import("@/db/migrate")
  await migrateModule.runMigrations()

  const dbModule = await import("@/db/db")
  const db = dbModule.initDb()

  const cleanup = () => {
    db.destroy()
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  }

  return { db, cleanup, testDir }
}
