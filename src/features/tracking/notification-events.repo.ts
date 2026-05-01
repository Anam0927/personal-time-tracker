import type { Selectable } from "kysely"

import { BaseRepository } from "@/lib/db/base-repo"
import { NotFoundError } from "@/lib/db/errors"
import type { NotificationEvent } from "@/lib/db/types"

export interface NotificationEventsRepository {
  create(data: {
    sessionId: number
    thresholdMinutes: number
    thresholdReachedAt: string
  }): Promise<Selectable<NotificationEvent>>
  markSent({ id, type }: { id: number; type: string }): Promise<Selectable<NotificationEvent>>
  getBySessionId(sessionId: number): Promise<Selectable<NotificationEvent>[]>
}

export class NotificationEventsRepositoryImpl
  extends BaseRepository
  implements NotificationEventsRepository
{
  async create(data: {
    sessionId: number
    thresholdMinutes: number
    thresholdReachedAt: string
  }): Promise<Selectable<NotificationEvent>> {
    return await this.db
      .insertInto("notificationEvents")
      .values({
        sessionId: data.sessionId,
        thresholdMinutes: data.thresholdMinutes,
        thresholdReachedAt: data.thresholdReachedAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async markSent({
    id,
    type,
  }: {
    id: number
    type: string
  }): Promise<Selectable<NotificationEvent>> {
    const result = await this.db
      .updateTable("notificationEvents")
      .set({
        notificationSentAt: new Date().toISOString(),
        notificationType: type,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("NotificationEvent", id)
    return result
  }

  async getBySessionId(sessionId: number): Promise<Selectable<NotificationEvent>[]> {
    return await this.db
      .selectFrom("notificationEvents")
      .selectAll()
      .where("sessionId", "=", sessionId)
      .orderBy("thresholdReachedAt", "asc")
      .execute()
  }
}
