import { afterEach, expect, it } from "bun:test"

import { cleanup, render } from "../tests/mocks/tty"

const bunPath = process.execPath

afterEach(() => {
  cleanup()
})

const createTerminal = () =>
  new Bun.Terminal({
    cols: 80,
    rows: 24,
  })

it("renders the TUI", async () => {
  const { TuiShell } = await import(`./app.tsx?test=${Math.random()}`)
  const app = render(<TuiShell />)

  expect(app.lastFrame()).toContain("Time tracker TUI - Press 'q', 'x', or 'Esc' to exit.")
})

it("quits normally when 'q' is pressed", async () => {
  const terminal = createTerminal()
  const proc = Bun.spawn([bunPath, "run", "cli", "tui"], {
    terminal,
  })

  proc.terminal?.write("q")

  const exitCode = await proc.exited
  expect(exitCode).toBe(0)
})

it("quits with code 130 when Ctrl+C is pressed", async () => {
  const terminal = createTerminal()
  const proc = Bun.spawn([bunPath, "run", "cli", "tui"], {
    terminal,
  })

  proc.kill("SIGINT")

  const exitCode = await proc.exited
  expect(exitCode).toBe(130)
})

it("should exit when not in a TTY environment", async () => {
  const proc = Bun.spawn([bunPath, "run", "cli", "tui"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })

  const exitCode = await proc.exited
  expect(exitCode).toBe(1)
})
