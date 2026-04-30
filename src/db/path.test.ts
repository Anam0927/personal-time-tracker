import { afterEach, describe, expect, it, mock } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

describe("getDbDir", () => {
  it("returns path ending in time-tracker", async () => {
    mock.module("xdg-basedir", () => ({ xdgData: "/test/data" }))

    // Use dynamic import since mock.module must be registered before module load
    const { getDbDir } = await import("./path")
    expect(getDbDir()).toBe(path.join("/test/data", "time-tracker"))
  })

  it("throws when xdgData is null", async () => {
    mock.module("xdg-basedir", () => ({ xdgData: null }))

    const { getDbDir } = await import("./path")
    expect(() => getDbDir()).toThrow("XDG_DATA_HOME")
  })
})

describe("getDbPath", () => {
  it("returns path ending in db.sqlite", async () => {
    mock.module("xdg-basedir", () => ({ xdgData: "/test/data" }))

    const { getDbPath } = await import("./path")
    expect(getDbPath()).toBe(path.join("/test/data", "time-tracker", "db.sqlite"))
  })
})

describe("ensureDbDir", () => {
  const testDir = path.join(os.tmpdir(), `time-tracker-test-${Date.now()}`)

  afterEach(() => {
    // Clean up the test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it("creates directory if missing", async () => {
    mock.module("xdg-basedir", () => ({ xdgData: testDir }))

    const { ensureDbDir } = await import("./path")
    const result = ensureDbDir()
    expect(result).toBe(path.join(testDir, "time-tracker"))
    expect(existsSync(path.join(testDir, "time-tracker"))).toBe(true)
  })

  it("is idempotent when directory already exists", async () => {
    mock.module("xdg-basedir", () => ({ xdgData: testDir }))

    const { ensureDbDir } = await import("./path")
    // First call creates
    ensureDbDir()
    // Second call should not throw
    expect(() => ensureDbDir()).not.toThrow()
  })
})
