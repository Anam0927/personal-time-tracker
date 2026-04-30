import { describe, expect, it, mock, beforeAll, afterAll } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const testDir = path.join(os.tmpdir(), `time-tracker-migrate-test-${Date.now()}`)

describe("runMigrations", () => {
  beforeAll(() => {
    // Point xdgData to a temp directory for clean database creation
    // Note: This must be set before the module is imported
    mock.module("xdg-basedir", () => ({ xdgData: testDir }))
  })

  afterAll(() => {
    // Cleanup: remove the test database
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it("applies all pending migrations", async () => {
    const { runMigrations } = await import("./migrate")
    const results = await runMigrations()
    // Should have results
    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    // At least one migration should have been applied
    expect(results!.length).toBeGreaterThan(0)
    // All should be Success
    for (const result of results!) {
      expect(result.status).toBe("Success")
    }
  })
})
