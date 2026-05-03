import { afterEach, expect, it } from "bun:test"

import { Box, Text } from "ink"

import { cleanup, render } from "@/tests/mocks/tty"

afterEach(() => {
  cleanup()
})

it("renders the exit hint", async () => {
  const { Shell } = await import(`./shell.tsx?test=${Math.random()}`)
  const app = render(
    <Shell>
      <Box />
    </Shell>,
  )
  expect(app.lastFrame()).toContain("Press 'q', 'x', or 'Esc' to exit.")
})

it("renders children", async () => {
  const { Shell } = await import(`./shell.tsx?test=${Math.random()}`)
  const app = render(
    <Shell>
      <Text>test child</Text>
    </Shell>,
  )
  expect(app.lastFrame()).toContain("test child")
})
