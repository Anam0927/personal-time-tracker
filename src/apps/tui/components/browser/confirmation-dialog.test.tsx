import { afterEach, expect, it } from "bun:test"

import { cleanup, render } from "@/tests/mocks/tty"

import { ConfirmationDialog } from "./confirmation-dialog.js"

afterEach(() => {
  cleanup()
})

it("renders the message text", async () => {
  const app = render(
    <ConfirmationDialog message="Switch to ProjectX?" onConfirm={() => {}} onCancel={() => {}} />,
  )
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("Switch to ProjectX?")
})

it("renders instruction text", async () => {
  const app = render(<ConfirmationDialog message="Test" onConfirm={() => {}} onCancel={() => {}} />)
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("Enter to confirm")
  expect(app.lastFrame()).toContain("Esc to cancel")
})

it("pressing Enter calls onConfirm", async () => {
  let confirmed = false
  const app = render(
    <ConfirmationDialog
      message="Confirm?"
      onConfirm={() => {
        confirmed = true
      }}
      onCancel={() => {}}
    />,
  )
  await app.waitUntilRenderFlush()

  app.stdin.write("\r")
  await app.waitUntilRenderFlush()

  expect(confirmed).toBe(true)
})

it("pressing Esc calls onCancel", async () => {
  let cancelled = false
  const app = render(
    <ConfirmationDialog
      message="Cancel?"
      onConfirm={() => {}}
      onCancel={() => {
        cancelled = true
      }}
    />,
  )
  await app.waitUntilRenderFlush()

  // Escape (\x1b) needs a small delay because Ink's input parser
  // waits briefly to distinguish standalone Escape from ANSI sequences
  app.stdin.write("\x1b")
  await new Promise((r) => setTimeout(r, 50))
  await app.waitUntilRenderFlush()

  expect(cancelled).toBe(true)
})
