import { describe, expect, it, beforeEach, afterEach, jest } from "bun:test"

import type { Selectable } from "kysely"

import type { PauseEvent } from "../types"
import { calculateElapsedMinutes } from "./utils"

const FAKE_NOW = new Date("2026-01-01T02:00:00.000Z")

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FAKE_NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

function pauseEvent({
  pausedAt,
  resumedAt,
}: {
  pausedAt: string
  resumedAt: string | null
}): Selectable<PauseEvent> {
  return {
    id: 1,
    sessionId: 1,
    pausedAt,
    resumedAt,
    reason: null,
    createdAt: pausedAt,
  }
}

describe("calculateElapsedMinutes", () => {
  it("returns 0 when started just now with no pauses", () => {
    const result = calculateElapsedMinutes(FAKE_NOW.toISOString(), [])
    expect(result).toBe(0)
  })

  it("returns elapsed minutes with no pauses", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const result = calculateElapsedMinutes(startedAt.toISOString(), [])
    expect(result).toBe(60)
  })

  it("excludes completed pause duration from elapsed time", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const pauses = [
      pauseEvent({
        pausedAt: "2026-01-01T01:15:00.000Z",
        resumedAt: "2026-01-01T01:30:00.000Z",
      }),
    ]
    const result = calculateElapsedMinutes(startedAt.toISOString(), pauses)
    expect(result).toBe(45)
  })

  it("stops counting at active pause start", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const pauses = [
      pauseEvent({
        pausedAt: "2026-01-01T01:45:00.000Z",
        resumedAt: null,
      }),
    ]
    const result = calculateElapsedMinutes(startedAt.toISOString(), pauses)
    expect(result).toBe(45)
  })

  it("handles multiple completed pauses", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const pauses = [
      pauseEvent({
        pausedAt: "2026-01-01T01:10:00.000Z",
        resumedAt: "2026-01-01T01:15:00.000Z",
      }),
      pauseEvent({
        pausedAt: "2026-01-01T01:30:00.000Z",
        resumedAt: "2026-01-01T01:35:00.000Z",
      }),
    ]
    const result = calculateElapsedMinutes(startedAt.toISOString(), pauses)
    expect(result).toBe(50)
  })

  it("handles mixed completed and active pauses", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const pauses = [
      pauseEvent({
        pausedAt: "2026-01-01T01:10:00.000Z",
        resumedAt: "2026-01-01T01:15:00.000Z",
      }),
      pauseEvent({
        pausedAt: "2026-01-01T01:40:00.000Z",
        resumedAt: null,
      }),
    ]
    const result = calculateElapsedMinutes(startedAt.toISOString(), pauses)
    expect(result).toBe(35)
  })

  it("limits elapsed time to the start of an active pause", () => {
    const startedAt = new Date("2026-01-01T01:00:00.000Z")
    const pauses = [
      pauseEvent({
        pausedAt: "2026-01-01T01:05:00.000Z",
        resumedAt: null,
      }),
    ]
    const result = calculateElapsedMinutes(startedAt.toISOString(), pauses)
    expect(result).toBe(5)
  })

  it("returns 0 for extremely short elapsed time", () => {
    const startedAt = new Date("2026-01-01T01:59:59.000Z")
    const result = calculateElapsedMinutes(startedAt.toISOString(), [])
    expect(result).toBe(0)
  })
})
