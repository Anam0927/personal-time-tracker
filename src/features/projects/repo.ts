import type { Selectable } from "kysely"
import type { Updateable } from "kysely"

import { BaseRepository } from "@/lib/db/base-repo"
import { NotFoundError, ConstraintViolationError } from "@/lib/db/errors"
import type { Project } from "@/lib/db/types"

export interface ProjectsRepository {
  create(data: {
    name: string
    clientId?: number | null
    description?: string | null
    color?: string | null
  }): Promise<Selectable<Project>>
  getById(id: number): Promise<Selectable<Project> | null>
  getByName(name: string): Promise<Selectable<Project> | null>
  list(opts?: { clientId?: number; includeArchived?: boolean }): Promise<Selectable<Project>[]>
  archive(id: number): Promise<Selectable<Project>>
  unarchive(id: number): Promise<Selectable<Project>>
  update(
    id: number,
    data: {
      name?: string
      clientId?: number | null
      description?: string | null
      color?: string | null
    },
  ): Promise<Selectable<Project>>
}

export class ProjectsRepositoryImpl extends BaseRepository implements ProjectsRepository {
  async create(data: {
    name: string
    clientId?: number | null
    description?: string | null
    color?: string | null
  }): Promise<Selectable<Project>> {
    try {
      const result = await this.db
        .insertInto("projects")
        .values({
          name: data.name,
          clientId: data.clientId ?? null,
          description: data.description ?? null,
          color: data.color ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("Project", "name")
      }

      throw error
    }
  }

  async getById(id: number): Promise<Selectable<Project> | null> {
    const project = await this.db
      .selectFrom("projects")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()

    return project ?? null
  }

  async getByName(name: string): Promise<Selectable<Project> | null> {
    const project = await this.db
      .selectFrom("projects")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst()

    return project ?? null
  }

  async list(opts?: {
    clientId?: number
    includeArchived?: boolean
  }): Promise<Selectable<Project>[]> {
    let query = this.db.selectFrom("projects").selectAll()

    if (opts?.clientId !== undefined) {
      query = query.where("clientId", "=", opts.clientId)
    }

    if (!opts?.includeArchived) {
      query = query.where("archived", "=", 0)
    }

    return await query.execute()
  }

  async archive(id: number): Promise<Selectable<Project>> {
    const result = await this.db
      .updateTable("projects")
      .set({ archived: 1 })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Project", id)

    return result
  }

  async unarchive(id: number): Promise<Selectable<Project>> {
    const result = await this.db
      .updateTable("projects")
      .set({ archived: 0 })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Project", id)

    return result
  }

  async update(
    id: number,
    data: {
      name?: string
      clientId?: number | null
      description?: string | null
      color?: string | null
    },
  ): Promise<Selectable<Project>> {
    const updateData: Updateable<Project> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.color !== undefined) updateData.color = data.color
    if (data.clientId !== undefined) updateData.clientId = data.clientId

    try {
      const result = await this.db
        .updateTable("projects")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst()

      if (!result) throw new NotFoundError("Project", id)

      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("Project", "name")
      }

      throw error
    }
  }
}
