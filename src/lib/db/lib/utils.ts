import { differenceInMilliseconds, millisecondsToMinutes } from "date-fns"
import type { Selectable } from "kysely"

import type { PauseEvent } from "../types"

export function calculateElapsedMinutes(
  startedAt: string,
  pauseEvents: Selectable<PauseEvent>[],
): number {
  const start = new Date(startedAt)

  let completedPauseMs = 0
  let currentPauseStart: Date | null = null

  for (const pe of pauseEvents) {
    const pausedAt = new Date(pe.pausedAt)

    if (pe.resumedAt) {
      completedPauseMs += differenceInMilliseconds(new Date(pe.resumedAt), pausedAt)
    } else {
      currentPauseStart = pausedAt
    }
  }

  const effectiveNow = currentPauseStart ?? new Date()
  const elapsedMs = differenceInMilliseconds(effectiveNow, start) - completedPauseMs

  return millisecondsToMinutes(elapsedMs)
}
