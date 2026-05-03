import { type Kysely, type Selectable } from "kysely"

import { calculateElapsedMinutes } from "@/lib/db/lib/utils"
import type { DB, PauseEvent } from "@/lib/db/types"

import {
  SessionsRepositoryImpl,
  type ActiveSession,
  type SessionWithDetails,
  type SessionWithPauseEvents,
  type SessionsRepository,
} from "./sessions.repo"
import { PauseEventsRepositoryImpl, type PauseEventsRepository } from "./pause-events.repo"

// ---- Domain Types ----

export interface TodayTotals {
  totalElapsedMinutes: number
  sessionCount: number
}

export interface DashboardData {
  activeSession: ActiveSession | null
  todayTotals: TodayTotals
  recentSessions: (SessionWithDetails & { elapsedMinutes: number })[]
}

// ---- Service ----

export class DashboardService {
  private readonly sessionsRepo: SessionsRepository
  private readonly pauseEventsRepo: PauseEventsRepository

  constructor(private readonly db: Kysely<DB>) {
    this.sessionsRepo = new SessionsRepositoryImpl(db)
    this.pauseEventsRepo = new PauseEventsRepositoryImpl(db)
  }

  async getDashboardData(): Promise<DashboardData> {
    const [activeSession, todaySessions, recentSessions] = await Promise.all([
      this.sessionsRepo.getActive(),
      this.sessionsRepo.getTodaySessions(),
      this.sessionsRepo.listHistoryWithDetails({ limit: 5 }),
    ])

    const todayTotals = this.computeTodayTotals(todaySessions)

    // Batch-fetch pause events for recent sessions to compute accurate elapsed time
    const recentPauseEvents = await this.fetchPauseEventsBySessionIds(
      recentSessions.map((s) => s.id),
    )

    return {
      activeSession,
      todayTotals,
      recentSessions: recentSessions.map((s) => ({
        ...s,
        elapsedMinutes: calculateElapsedMinutes(
          s.startedAt,
          recentPauseEvents.get(s.id) ?? [],
          s.endedAt,
        ),
      })),
    }
  }

  private computeTodayTotals(todaySessions: SessionWithPauseEvents[]): TodayTotals {
    let totalElapsedMinutes = 0
    for (const { session, pauseEvents } of todaySessions) {
      totalElapsedMinutes += session.status === "completed"
        ? calculateElapsedMinutes(session.startedAt, pauseEvents, session.endedAt)
        : calculateElapsedMinutes(session.startedAt, pauseEvents)
    }

    return {
      totalElapsedMinutes,
      sessionCount: todaySessions.length,
    }
  }

  private async fetchPauseEventsBySessionIds(
    sessionIds: number[],
  ): Promise<Map<number, Selectable<PauseEvent>[]>> {
    if (sessionIds.length === 0) return new Map()

    const allPauseEvents = await this.pauseEventsRepo.getBySessionIds(sessionIds)

    const map = new Map<number, Selectable<PauseEvent>[]>()
    for (const pe of allPauseEvents) {
      const list = map.get(pe.sessionId) ?? []
      list.push(pe)
      map.set(pe.sessionId, list)
    }
    return map
  }
}
