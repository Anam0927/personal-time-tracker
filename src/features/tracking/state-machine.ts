import type { Selectable } from "kysely"

import type { Session } from "@/lib/db/types"

export type SessionStatus = Session["status"]

export type TransitionResult =
  | { variant: "transitioned"; session: Selectable<Session> }
  | { variant: "invalidTransition"; from: SessionStatus; to: SessionStatus }
  | { variant: "staleState"; expected: SessionStatus; actual: SessionStatus }
  | { variant: "notFound" }

const VALID_TRANSITIONS: ReadonlyMap<SessionStatus, ReadonlySet<SessionStatus>> = new Map([
  ["active", Object.freeze(new Set<SessionStatus>(["paused", "completed"]))],
  ["paused", Object.freeze(new Set<SessionStatus>(["active", "completed"]))],
  ["completed", Object.freeze(new Set<SessionStatus>())],
])

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  const allowed = VALID_TRANSITIONS.get(from)
  return allowed !== undefined && allowed.has(to)
}
