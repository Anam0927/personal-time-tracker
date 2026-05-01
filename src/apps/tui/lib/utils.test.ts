import { describe, expect, it } from "bun:test"

import { shouldExitNormally } from "./utils"

describe("shouldExitNormally", () => {
  const trueCases = [
    { input: "q", isEscape: false },
    { input: "Q", isEscape: false },
    { input: "x", isEscape: false },
    { input: "X", isEscape: false },
    { input: " x ", isEscape: false },
    { input: " ", isEscape: true },
  ]

  it.each(trueCases)(
    "returns true for input '$input' with isEscape=$isEscape",
    ({ input, isEscape }) => {
      const result = shouldExitNormally(input, isEscape)
      expect(result).toBe(true)
    },
  )

  const falseCases = [
    { input: "", isEscape: false },
    { input: "a", isEscape: false },
    { input: "quit", isEscape: false },
    { input: " ", isEscape: false },
  ]

  it.each(falseCases)(
    "returns false for input '$input' with isEscape=$isEscape",
    ({ input, isEscape }) => {
      const result = shouldExitNormally(input, isEscape)
      expect(result).toBe(false)
    },
  )
})
