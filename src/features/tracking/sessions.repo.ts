import type { Kysely, Selectable, Transaction } from "kysely"

import {
  canTransition,
  type SessionStatus,
  type TransitionResult,
} from "@/features/tracking/state-machine"
import { BaseRepository } from "@/lib/db/base-repo"
import { NotFoundError } from "@/lib/db/errors"
import { calculateElapsedMinutes } from "@/lib/db/lib/utils"
import type { DB } from "@/lib/db/types"
import type { Session } from "@/lib/db/types"

function parseSessionStatus(value: string): SessionStatus {
  if (value === "active" || value === "paused" || value === "completed") {
    return value
  }
  throw new Error(`Invalid session status: ${value}`)
}

export type ActiveSession = Selectable<Session> & {
  projectName: string | null
  clientName: string | null
  elapsedMinutes: number
}

export interface SessionsRepository {
  create(data: {
    status: Session["status"]
    startedAt: string
    projectId?: number | null
    note?: string | null
    thresholdMinutes?: number | null
  }): Promise<Selectable<Session>>
  getById(id: number): Promise<Selectable<Session> | null>
  listHistory(opts?: { limit?: number; offset?: number }): Promise<Selectable<Session>[]>
  updateNote({ sessionId, note }: { sessionId: number; note: string }): Promise<Selectable<Session>>
  transition(params: {
    sessionId: number
    from: SessionStatus
    to: SessionStatus
  }): Promise<TransitionResult>
  setThreshold({
    sessionId,
    minutes,
  }: {
    sessionId: number
    minutes: number
  }): Promise<Selectable<Session>>
  setEndedAt({
    sessionId,
    endedAt,
  }: {
    sessionId: number
    endedAt: string
  }): Promise<Selectable<Session>>
  setProject({
    sessionId,
    projectId,
  }: {
    sessionId: number
    projectId: number | null
  }): Promise<Selectable<Session>>
  getActive(): Promise<ActiveSession | null>
  getActiveSessionRow(): Promise<Selectable<Session> | null>
}

export class SessionsRepositoryImpl extends BaseRepository implements SessionsRepository {
  async create(data: {
    status: Session["status"]
    startedAt: string
    projectId?: number | null
    note?: string | null
    thresholdMinutes?: number | null
  }): Promise<Selectable<Session>> {
    return await this.db
      .insertInto("sessions")
      .values({
        status: data.status,
        startedAt: data.startedAt,
        projectId: data.projectId ?? null,
        note: data.note ?? null,
        thresholdMinutes: data.thresholdMinutes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async getById(id: number): Promise<Selectable<Session> | null> {
    const session = await this.db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()

    return session ?? null
  }

  async listHistory(opts?: { limit?: number; offset?: number }): Promise<Selectable<Session>[]> {
    let query = this.db.selectFrom("sessions").selectAll().orderBy("startedAt", "desc")

    if (opts?.limit) {
      query = query.limit(opts.limit)
    }

    if (opts?.offset) {
      query = query.offset(opts.offset)
    }

    return await query.execute()
  }

  async updateNote({
    sessionId,
    note,
  }: {
    sessionId: number
    note: string
  }): Promise<Selectable<Session>> {
    const result = await this.db
      .updateTable("sessions")
      .set({ note })
      .where("id", "=", sessionId)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Session", sessionId)

    return result
  }

  async transition(params: {
    sessionId: number
    from: SessionStatus
    to: SessionStatus
  }): Promise<TransitionResult> {
    if (!canTransition(params.from, params.to)) {
      return { variant: "invalidTransition", from: params.from, to: params.to }
    }

    const exec = async (db: Kysely<DB> | Transaction<DB>): Promise<TransitionResult> => {
      const result = await db
        .updateTable("sessions")
        .set({
          status: params.to,
          ...(params.to === "completed" ? { endedAt: new Date().toISOString() } : {}),
        })
        .where("id", "=", params.sessionId)
        .where("status", "=", params.from)
        .returningAll()
        .executeTakeFirst()

      if (!result) {
        const session = await db
          .selectFrom("sessions")
          .selectAll()
          .where("id", "=", params.sessionId)
          .executeTakeFirst()

        if (!session) {
          return { variant: "notFound" }
        }
        return {
          variant: "staleState",
          expected: params.from,
          actual: parseSessionStatus(session.status),
        }
      }

      return { variant: "transitioned", session: result }
    }

    // Transaction doesn't support .transaction() — skip wrapping if already inside one
    if (this.db.isTransaction) {
      return await exec(this.db)
    }

    return await this.db.transaction().execute(async (tx) => exec(tx))
  }

  async setThreshold({
    sessionId,
    minutes,
  }: {
    sessionId: number
    minutes: number
  }): Promise<Selectable<Session>> {
    const result = await this.db
      .updateTable("sessions")
      .set({ thresholdMinutes: minutes })
      .where("id", "=", sessionId)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Session", sessionId)

    return result
  }

  async setEndedAt({
    sessionId,
    endedAt,
  }: {
    sessionId: number
    endedAt: string
  }): Promise<Selectable<Session>> {
    const result = await this.db
      .updateTable("sessions")
      .set({ endedAt })
      .where("id", "=", sessionId)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Session", sessionId)

    return result
  }

  async setProject({
    sessionId,
    projectId,
  }: {
    sessionId: number
    projectId: number | null
  }): Promise<Selectable<Session>> {
    const result = await this.db
      .updateTable("sessions")
      .set({ projectId })
      .where("id", "=", sessionId)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Session", sessionId)

    return result
  }

  async getActive(): Promise<ActiveSession | null> {
    const row = await this.db
      .selectFrom("sessions")
      .leftJoin("projects", "projects.id", "sessions.projectId")
      .leftJoin("clients", "clients.id", "projects.clientId")
      .selectAll("sessions")
      .select(["projects.name as projectName", "clients.name as clientName"])
      .where("sessions.status", "in", ["active", "paused"])
      .limit(1)
      .executeTakeFirst()

    if (!row) {
      return null
    }

    const pauseEvents = await this.db
      .selectFrom("pauseEvents")
      .selectAll()
      .where("sessionId", "=", row.id)
      .execute()

    const elapsedMinutes = calculateElapsedMinutes(row.startedAt, pauseEvents)

    return {
      ...row,
      projectName: row.projectName ?? null,
      clientName: row.clientName ?? null,
      elapsedMinutes,
    }
  }

  async getActiveSessionRow(): Promise<Selectable<Session> | null> {
    const session = await this.db
      .selectFrom("sessions")
      .selectAll()
      .where("status", "in", ["active", "paused"])
      .limit(1)
      .executeTakeFirst()

    return session ?? null
  }
}
