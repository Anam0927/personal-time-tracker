import type { Selectable } from "kysely"

import { NotFoundError } from "../lib/errors"
import type { PauseEvent } from "../types"
import { BaseRepository } from "./base"

export interface PauseEventsRepository {
  create({
    sessionId,
    reason,
  }: {
    sessionId: number
    reason?: string | null
  }): Promise<Selectable<PauseEvent>>
  resume(pauseEventId: number): Promise<Selectable<PauseEvent>>
  getBySessionId(sessionId: number): Promise<Selectable<PauseEvent>[]>
  getActivePause(sessionId: number): Promise<Selectable<PauseEvent> | null>
}

export class PauseEventsRepositoryImpl extends BaseRepository implements PauseEventsRepository {
  async create({
    sessionId,
    reason,
  }: {
    sessionId: number
    reason?: string | null
  }): Promise<Selectable<PauseEvent>> {
    return await this.db
      .insertInto("pauseEvents")
      .values({
        sessionId,
        pausedAt: new Date().toISOString(),
        reason: reason ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async resume(pauseEventId: number): Promise<Selectable<PauseEvent>> {
    const result = await this.db
      .updateTable("pauseEvents")
      .set({ resumedAt: new Date().toISOString() })
      .where("id", "=", pauseEventId)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("PauseEvent", pauseEventId)
    return result
  }

  async getBySessionId(sessionId: number): Promise<Selectable<PauseEvent>[]> {
    return await this.db
      .selectFrom("pauseEvents")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .orderBy("pausedAt", "asc")
      .execute()
  }

  async getActivePause(sessionId: number): Promise<Selectable<PauseEvent> | null> {
    const pauseEvent = await this.db
      .selectFrom("pauseEvents")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .where("resumedAt", "is", null)
      .limit(1)
      .executeTakeFirst()

    return pauseEvent ?? null
  }
}
