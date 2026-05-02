import { describe, expect, it } from "bun:test"

import { canTransition } from "@/features/tracking/state-machine"

describe("state-machine", () => {
  describe("canTransition", () => {
    it.each([
      ["active", "paused", true],
      ["active", "completed", true],
      ["paused", "active", true],
      ["paused", "completed", true],
      ["active", "active", false],
      ["paused", "paused", false],
      ["completed", "active", false],
      ["completed", "paused", false],
      ["completed", "completed", false],
    ] as const)("canTransition(%s -> %s) returns %s", (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected)
    })
  })
})
