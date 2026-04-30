import { afterAll, describe, expect, it, mock } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

let currentXdgConfig: string | undefined = "/xdg-config-home"

function setupXdgMock(): void {
  mock.module("xdg-basedir", () => ({
    get xdgConfig() {
      return currentXdgConfig
    },
    xdgState: "/unused-xdg-state",
  }))
}

async function importLoadConfig(): Promise<typeof import("./load").loadConfig> {
  return (await import(`./load.ts?test=${Math.random().toString(36).slice(2)}`)).loadConfig
}

async function withTempDirectory(run: (tempDir: string) => Promise<void>): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "time-tracker-config-"))

  try {
    await run(tempDir)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function withCwd(cwd: string, run: () => Promise<void>): Promise<void> {
  const originalCwd = process.cwd()

  process.chdir(cwd)

  try {
    await run()
  } finally {
    process.chdir(originalCwd)
  }
}

describe("loadConfig", () => {
  afterAll(() => {
    mock.restore()
  })

  it("resolves --config relative path from cwd semantics", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const relativeConfigPath = "config/local.json"
      const absoluteConfigPath = path.join(projectDir, relativeConfigPath)

      await mkdir(path.dirname(absoluteConfigPath), { recursive: true })
      await writeFile(
        absoluteConfigPath,
        JSON.stringify({
          logging: { level: "debug", retentionPeriodInDays: 9 },
        }),
      )

      currentXdgConfig = path.join(tempDir, "xdg-config-home")
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig(relativeConfigPath)

        expect(config.logging.level).toBe("debug")
        expect(config.logging.retentionPeriodInDays).toBe(9)
      })
    })
  })

  it("supports --config absolute path", async () => {
    await withTempDirectory(async (tempDir) => {
      const absoluteConfigPath = path.join(tempDir, "config.json")

      await writeFile(
        absoluteConfigPath,
        JSON.stringify({
          logging: { level: "warn", retentionPeriodInDays: 5 },
        }),
      )

      currentXdgConfig = path.join(tempDir, "xdg-config-home")
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      const config = await loadConfig(absoluteConfigPath)

      expect(config.logging.level).toBe("warn")
      expect(config.logging.retentionPeriodInDays).toBe(5)
    })
  })

  it("uses discovered project config from package.json", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")

      await mkdir(projectDir, { recursive: true })
      await mkdir(xdgDir, { recursive: true })

      await writeFile(
        path.join(projectDir, "package.json"),
        JSON.stringify({
          name: "time-tracker-test",
          "time-tracker": {
            logging: { level: "warn", retentionPeriodInDays: 3 },
          },
        }),
      )

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig()

        expect(config).toEqual({
          tracking: {
            shortSleepThresholdInMinutes: 5,
            reminders: {
              repeatIntervalInMinutes: 5,
            },
          },
          logging: {
            level: "warn",
            retentionPeriodInDays: 3,
          },
        })
      })
    })
  })

  it("uses discovered project config from .time-trackerrc.json", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")

      await mkdir(projectDir, { recursive: true })
      await mkdir(xdgDir, { recursive: true })

      await writeFile(
        path.join(projectDir, ".time-trackerrc.json"),
        JSON.stringify({
          logging: { level: "warn", retentionPeriodInDays: 13 },
        }),
      )

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig()

        expect(config).toEqual({
          tracking: {
            shortSleepThresholdInMinutes: 5,
            reminders: {
              repeatIntervalInMinutes: 5,
            },
          },
          logging: {
            level: "warn",
            retentionPeriodInDays: 13,
          },
        })
      })
    })
  })

  it("uses discovered project config from time-tracker.config.json", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")

      await mkdir(projectDir, { recursive: true })
      await mkdir(xdgDir, { recursive: true })

      await writeFile(
        path.join(projectDir, "time-tracker.config.json"),
        JSON.stringify({
          logging: { level: "warn", retentionPeriodInDays: 30 },
        }),
      )

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig()

        expect(config).toEqual({
          tracking: {
            shortSleepThresholdInMinutes: 5,
            reminders: {
              repeatIntervalInMinutes: 5,
            },
          },
          logging: {
            level: "warn",
            retentionPeriodInDays: 30,
          },
        })
      })
    })
  })

  it("falls back to global config path when discovery is empty", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")
      const globalConfigPath = path.join(xdgDir, "time-tracker", "config.json")

      await mkdir(projectDir, { recursive: true })
      await mkdir(path.dirname(globalConfigPath), { recursive: true })
      await writeFile(
        globalConfigPath,
        JSON.stringify({
          logging: { level: "error", retentionPeriodInDays: 12 },
        }),
      )

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig()

        expect(config.logging.level).toBe("error")
        expect(config.logging.retentionPeriodInDays).toBe(12)
      })
    })
  })

  it("falls back to parseConfig({}) defaults when global config read hits ENOENT", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")

      await mkdir(projectDir, { recursive: true })
      await mkdir(xdgDir, { recursive: true })

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        const config = await loadConfig()

        expect(config).toEqual({
          tracking: {
            shortSleepThresholdInMinutes: 5,
            reminders: {
              repeatIntervalInMinutes: 5,
            },
          },
          logging: {
            level: "info",
            retentionPeriodInDays: 7,
          },
        })
      })
    })
  })

  it("throws when global config JSON is malformed", async () => {
    await withTempDirectory(async (tempDir) => {
      const projectDir = path.join(tempDir, "project")
      const xdgDir = path.join(tempDir, "xdg-config-home")
      const globalConfigPath = path.join(xdgDir, "time-tracker", "config.json")

      await mkdir(projectDir, { recursive: true })
      await mkdir(path.dirname(globalConfigPath), { recursive: true })
      await writeFile(globalConfigPath, "{")

      currentXdgConfig = xdgDir
      mock.restore()
      setupXdgMock()
      const loadConfig = await importLoadConfig()

      await withCwd(projectDir, async () => {
        expect(loadConfig()).rejects.toThrow()
      })
    })
  })
})
