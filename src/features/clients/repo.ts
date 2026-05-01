import type { Selectable } from "kysely"

import { BaseRepository } from "@/lib/db/base-repo"
import { NotFoundError, ConstraintViolationError } from "@/lib/db/errors"
import type { Client } from "@/lib/db/types"

interface ClientsRepository {
  create(name: string): Promise<Selectable<Client>>
  getById(id: number): Promise<Selectable<Client> | null>
  getByName(name: string): Promise<Selectable<Client> | null>
  list(opts?: { includeArchived?: boolean }): Promise<Selectable<Client>[]>
  archive(id: number): Promise<Selectable<Client>>
  unarchive(id: number): Promise<Selectable<Client>>
  update(id: number, data: { name?: string }): Promise<Selectable<Client>>
}

export class ClientsRepositoryImpl extends BaseRepository implements ClientsRepository {
  async create(name: string): Promise<Selectable<Client>> {
    try {
      const result = await this.db
        .insertInto("clients")
        .values({ name })
        .returningAll()
        .executeTakeFirstOrThrow()

      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("Client", "name")
      }

      throw error
    }
  }

  async getById(id: number): Promise<Selectable<Client> | null> {
    const client = await this.db
      .selectFrom("clients")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()

    return client ?? null
  }

  async getByName(name: string): Promise<Selectable<Client> | null> {
    const client = await this.db
      .selectFrom("clients")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst()

    return client ?? null
  }

  async list(opts?: { includeArchived?: boolean }): Promise<Selectable<Client>[]> {
    let query = this.db.selectFrom("clients").selectAll()

    if (!opts?.includeArchived) {
      query = query.where("archived", "=", 0)
    }

    return await query.execute()
  }

  async archive(id: number): Promise<Selectable<Client>> {
    const result = await this.db
      .updateTable("clients")
      .set({ archived: 1 })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Client", id)

    return result
  }

  async unarchive(id: number): Promise<Selectable<Client>> {
    const result = await this.db
      .updateTable("clients")
      .set({ archived: 0 })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()

    if (!result) throw new NotFoundError("Client", id)

    return result
  }

  async update(id: number, data: { name?: string }): Promise<Selectable<Client>> {
    try {
      const result = await this.db
        .updateTable("clients")
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst()

      if (!result) throw new NotFoundError("Client", id)

      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConstraintViolationError("Client", "name")
      }

      throw error
    }
  }
}
