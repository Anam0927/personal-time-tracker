import { afterEach, describe, expect, it, mock } from "bun:test"

import { Logger, createLogger } from "./logger"

describe("Logger class", () => {
  it.each([
    { method: "info", desc: "info" },
    { method: "info", desc: "info with details", details: true },
    { method: "error", desc: "error" },
    { method: "error", desc: "error with details", details: true },
    { method: "debug", desc: "debug" },
    { method: "debug", desc: "debug with details", details: true },
    { method: "warn", desc: "warn" },
    { method: "warn", desc: "warn with details", details: true },
  ])("delegates $desc", ({ method, details }) => {
    const pinoMock: Record<string, ReturnType<typeof mock>> = { [method]: mock() }
    const logger = new Logger(pinoMock as any)

    if (details) {
      logger[method]("hello", { user: "test" })
      expect(pinoMock[method]).toHaveBeenCalledWith({ user: "test" }, "hello")
    } else {
      logger[method]("hello")
      expect(pinoMock[method]).toHaveBeenCalledWith("hello")
    }
  })
})

describe("createLogger factory", () => {
  afterEach(() => {
    delete process.env.NODE_ENV
  })

  it("uses info as default level", () => {
    const logger = createLogger()
    expect(logger).toBeInstanceOf(Logger)
  })

  it("accepts an explicit log level", () => {
    const logger = createLogger("debug")
    expect(logger).toBeInstanceOf(Logger)
  })

  it("skips file transport in dev mode", () => {
    delete process.env.NODE_ENV
    const logger = createLogger()
    expect(logger).toBeInstanceOf(Logger)
  })

  it("throws in production when XDG_STATE_HOME is unset", async () => {
    mock.module("xdg-basedir", () => ({ xdgState: null }))
    process.env.NODE_ENV = "production"

    const { createLogger: createLoggerProd } = await import("./logger")
    expect(() => createLoggerProd()).toThrow("XDG_STATE_HOME")
  })

  it("creates file transport in production when XDG_STATE_HOME is set", async () => {
    mock.module("xdg-basedir", () => ({ xdgState: "/tmp/test-xdg" }))
    process.env.NODE_ENV = "production"

    const { createLogger: createLoggerProd } = await import("./logger")
    expect(() => createLoggerProd()).not.toThrow()
    expect(createLoggerProd()).toBeInstanceOf(Logger)
  })
})
