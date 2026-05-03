import { afterAll, afterEach, beforeAll, expect, it } from "bun:test"

import type { Kysely } from "kysely"

import type { DB } from "@/lib/db/types"
import { cleanup, render } from "@/tests/mocks/tty"
import { createTestDb } from "@/tests/test-helper"

const bunPath = process.execPath

let db: Kysely<DB>
let cleanupDb: () => void

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanupDb = ctx.cleanup
})

afterAll(() => {
  cleanupDb()
})

afterEach(() => {
  cleanup()
})

const createTerminal = () =>
  new Bun.Terminal({
    cols: 80,
    rows: 24,
  })

it("renders dashboard footer in default view", async () => {
  const { TuiShell } = await import(`./app.tsx?test=${Math.random()}`)
  const app = render(<TuiShell db={db} />)
  await app.waitUntilRenderFlush()

  // Dashboard view footer should show Tab hint
  expect(app.lastFrame()).toContain("Press Tab to browse projects")
})

it("switches to browser view when Tab is pressed", async () => {
  const { TuiShell } = await import(`./app.tsx?test=${Math.random()}`)
  const app = render(<TuiShell db={db} />)
  await app.waitUntilRenderFlush()

  // Simulate Tab key press via stdin
  app.stdin.write("\t")
  await app.waitUntilRenderFlush()

  // Should now show browser navigation hint
  expect(app.lastFrame()).toContain("↑↓/jk: Navigate")
})

it("switches back to dashboard when Tab is pressed again", async () => {
  const { TuiShell } = await import(`./app.tsx?test=${Math.random()}`)
  const app = render(<TuiShell db={db} />)
  await app.waitUntilRenderFlush()

  // Tab to browser
  app.stdin.write("\t")
  await app.waitUntilRenderFlush()

  // Tab back to dashboard
  app.stdin.write("\t")
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("Press Tab to browse projects")
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
