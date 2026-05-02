import type { Selectable } from "kysely"

import { BaseRepository } from "@/lib/db/base-repo"
import { ConstraintViolationError } from "@/lib/db/errors"
import type { Tag } from "@/lib/db/types"

export interface TagsRepository {
  create(name: string): Promise<Selectable<Tag>>
  getByName(name: string): Promise<Selectable<Tag> | null>
  list(): Promise<Selectable<Tag>[]>
  delete(id: number): Promise<void>
  addToSession({ sessionId, tagId }: { sessionId: number; tagId: number }): Promise<void>
  removeFromSession({ sessionId, tagId }: { sessionId: number; tagId: number }): Promise<void>
  getSessionTags(sessionId: number): Promise<Selectable<Tag>[]>
  removeAllSessionTags(sessionId: number): Promise<void>
}

export class TagsRepositoryImpl extends BaseRepository implements TagsRepository {
  async create(name: string): Promise<Selectable<Tag>> {
    try {
      return await this.db
        .insertInto("tags")
        .values({ name })
        .returningAll()
        .executeTakeFirstOrThrow()
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("Tag", "name")
      }
      throw error
    }
  }

  async getByName(name: string): Promise<Selectable<Tag> | null> {
    const tag = await this.db
      .selectFrom("tags")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst()

    return tag ?? null
  }

  async list(): Promise<Selectable<Tag>[]> {
    return await this.db.selectFrom("tags").selectAll().orderBy("name", "asc").execute()
  }

  async delete(id: number): Promise<void> {
    await this.db.deleteFrom("tags").where("id", "=", id).execute()
  }

  async addToSession({ sessionId, tagId }: { sessionId: number; tagId: number }): Promise<void> {
    try {
      await this.db.insertInto("sessionTags").values({ sessionId, tagId }).execute()
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("SessionTag", "sessionId, tagId")
      }
      throw error
    }
  }

  async removeFromSession({
    sessionId,
    tagId,
  }: {
    sessionId: number
    tagId: number
  }): Promise<void> {
    await this.db
      .deleteFrom("sessionTags")
      .where("sessionId", "=", sessionId)
      .where("tagId", "=", tagId)
      .execute()
  }

  async getSessionTags(sessionId: number): Promise<Selectable<Tag>[]> {
    return await this.db
      .selectFrom("sessionTags")
      .innerJoin("tags", "tags.id", "sessionTags.tagId")
      .selectAll("tags")
      .where("sessionTags.sessionId", "=", sessionId)
      .execute()
  }

  async removeAllSessionTags(sessionId: number): Promise<void> {
    await this.db
      .deleteFrom("sessionTags")
      .where("sessionId", "=", sessionId)
      .execute()
  }
}
