import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { ParsedCliCommand } from "./apps/cli/lib/parser.types"

const parseCliCommandMock = mock((_argv: string[]): ParsedCliCommand | null => null)

const tuiRunMock = mock(async (): Promise<number> => 0)

class InkTuiAppMock {
  run = tuiRunMock
}

const processExitMock = mock((_code?: number) => undefined as never)
const consoleErrorMock = mock((..._args: unknown[]) => undefined)
const originalProcessExit = process.exit
const originalConsoleError = console.error

async function runMainModule() {
  await import(`./main.ts?test=${Math.random().toString(36).slice(2)}`)
}

describe("main bootstrap", () => {
  beforeEach(() => {
    mock.restore()
    mock.clearAllMocks()

    // Mock only at system boundaries:
    // 1. args-parser — we need to control parser return for branch coverage
    mock.module("./apps/cli/lib/args-parser", () => ({
      parseCliCommand: parseCliCommandMock,
    }))
    // 2. TUI — system boundary (ink rendering can't run in test environment)
    mock.module("./apps/tui/app", () => ({
      InkTuiApp: InkTuiAppMock,
      TuiShell: () => "Time tracker TUI - Press 'q', 'x', or 'Esc' to exit.",
    }))

    process.exit = processExitMock as typeof process.exit
    console.error = consoleErrorMock as typeof console.error
  })

  afterAll(() => {
    mock.restore()
  })

  afterEach(() => {
    mock.restore()
    process.exit = originalProcessExit
    console.error = originalConsoleError
  })

  it("exits(1) when parser returns no command", async () => {
    parseCliCommandMock.mockReturnValueOnce(null)

    await runMainModule()

    expect(console.error).toHaveBeenCalledWith(
      'No command provided. Run "bun run cli -- help" to see available commands.',
    )
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it("keeps help ownership in bootstrap", async () => {
    parseCliCommandMock.mockReturnValueOnce({ kind: "help" })

    await runMainModule()

    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("keeps version ownership in bootstrap", async () => {
    parseCliCommandMock.mockReturnValueOnce({ kind: "version" })

    await runMainModule()

    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("loads config, creates logger, and runs app", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: { name: "status" },
    })

    await runMainModule()

    // Behavioral assertion: command ran successfully
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it("rejects tui when stdin is not a tty before loading config", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: { name: "tui" },
    })

    const originalStdin = process.stdin
    const originalStdout = process.stdout
    Object.defineProperty(process, "stdin", {
      value: { ...originalStdin, isTTY: false },
      configurable: true,
    })
    Object.defineProperty(process, "stdout", {
      value: { ...originalStdout, isTTY: true },
      configurable: true,
    })

    try {
      await runMainModule()
    } finally {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      })
      Object.defineProperty(process, "stdout", {
        value: originalStdout,
        configurable: true,
      })
    }

    expect(console.error).toHaveBeenCalledWith(
      "Interactive TUI requires a TTY session (stdin and stdout must both be terminals).",
    )
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it("runs tui and exits with code from TUI", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: { name: "tui" },
    })

    const originalStdin = process.stdin
    const originalStdout = process.stdout
    Object.defineProperty(process, "stdin", {
      value: { ...originalStdin, isTTY: true },
      configurable: true,
    })
    Object.defineProperty(process, "stdout", {
      value: { ...originalStdout, isTTY: true },
      configurable: true,
    })

    tuiRunMock.mockResolvedValueOnce(130)

    try {
      await runMainModule()
    } finally {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      })
      Object.defineProperty(process, "stdout", {
        value: originalStdout,
        configurable: true,
      })
    }

    expect(process.exit).toHaveBeenCalledWith(130)
  })

  it("handles commander errors", async () => {
    parseCliCommandMock.mockImplementationOnce(() => {
      throw Object.assign(new Error("commander failure"), {
        code: "commander.unknownOption",
        exitCode: 1,
      })
    })

    await runMainModule()

    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it("handles thrown errors and exits(2)", async () => {
    parseCliCommandMock.mockImplementationOnce(() => {
      throw new Error("boom")
    })

    await runMainModule()

    expect(console.error).toHaveBeenCalledWith("boom")
    expect(process.exit).toHaveBeenCalledWith(2)
  })
})
