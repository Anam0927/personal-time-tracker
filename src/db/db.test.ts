import { describe, expect, it, mock, beforeAll, afterAll } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const testDir = path.join(os.tmpdir(), `time-tracker-db-test-${Date.now()}`)

describe("initDb", () => {
  beforeAll(() => {
    mock.module("xdg-basedir", () => ({ xdgData: testDir }))
  })

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it("creates the database directory", async () => {
    const { initDb } = await import("./db")
    const db = initDb()
    expect(db).toBeDefined()
    expect(existsSync(path.join(testDir, "time-tracker"))).toBe(true)
    db.destroy()
  })

  it("is idempotent (returns cached instance)", async () => {
    const { initDb } = await import("./db")
    const first = initDb()
    const second = initDb()
    expect(first).toBe(second)
    first.destroy()
  })
})
