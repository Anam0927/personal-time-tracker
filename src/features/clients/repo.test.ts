import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import type { Kysely } from "kysely"

import { ConstraintViolationError } from "@/lib/db/errors"
import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ClientsRepositoryImpl } from "./repo"

let db: Kysely<DB>
let cleanup: () => void

let clientsRepo: ClientsRepositoryImpl

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  clientsRepo = new ClientsRepositoryImpl(db)
})

afterAll(() => {
  cleanup()
})

async function cleanAllTables(): Promise<void> {
  await db.deleteFrom("pauseEvents").execute()
  await db.deleteFrom("notificationEvents").execute()
  await db.deleteFrom("sessionTags").execute()
  await db.deleteFrom("sessions").execute()
  await db.deleteFrom("tags").execute()
  await db.deleteFrom("projects").execute()
  await db.deleteFrom("clients").execute()
}

// ─────────────────────────────────────────────────────────────
// ClientsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("ClientsRepositoryImpl", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  it("create() creates a client, returns object with id and name", async () => {
    const client = await clientsRepo.create("Acme Corp")
    expect(client).toBeDefined()
    expect(Number(client.id)).toBeGreaterThan(0)
    expect(client.name).toBe("Acme Corp")
  })

  it("create() throws ConstraintViolationError on duplicate name", async () => {
    await clientsRepo.create("Duplicate")
    expect(clientsRepo.create("Duplicate")).rejects.toThrow(ConstraintViolationError)
  })

  it("getById() returns client by id", async () => {
    const created = await clientsRepo.create("GetById Test")
    const found = await clientsRepo.getById(Number(created.id))
    expect(found).not.toBeNull()
    expect(found!.name).toBe("GetById Test")
  })

  it("getById() returns null for nonexistent id", async () => {
    const found = await clientsRepo.getById(999)
    expect(found).toBeNull()
  })

  it("getByName() returns client by name", async () => {
    await clientsRepo.create("ByName Test")
    const found = await clientsRepo.getByName("ByName Test")
    expect(found).not.toBeNull()
    expect(Number(found!.id)).toBeGreaterThan(0)
  })

  it("getByName() returns null for nonexistent name", async () => {
    const found = await clientsRepo.getByName("nonexistent")
    expect(found).toBeNull()
  })

  it("list() returns all non-archived clients by default", async () => {
    await clientsRepo.create("Alpha")
    await clientsRepo.create("Beta")
    const list = await clientsRepo.list()
    expect(list.length).toBe(2)
  })

  it("list({ includeArchived: true }) returns all clients including archived", async () => {
    const c = await clientsRepo.create("ArchiveMe")
    await clientsRepo.archive(Number(c.id))
    const all = await clientsRepo.list({ includeArchived: true })
    expect(all.length).toBe(1)
    expect(!!all[0]!.archived).toBe(true)
  })

  it("archive() sets archived to 1/true", async () => {
    const c = await clientsRepo.create("Archivable")
    const archived = await clientsRepo.archive(Number(c.id))
    expect(!!archived.archived).toBe(true)
  })

  it("unarchive() reverts archive", async () => {
    const c = await clientsRepo.create("Unarchivable")
    await clientsRepo.archive(Number(c.id))
    const unarchived = await clientsRepo.unarchive(Number(c.id))
    expect(!!unarchived.archived).toBe(false)
  })

  it("archive() is idempotent", async () => {
    const c = await clientsRepo.create("IdempotentArchive")
    await clientsRepo.archive(Number(c.id))
    const again = await clientsRepo.archive(Number(c.id))
    expect(!!again.archived).toBe(true)
  })

  it("update() updates name", async () => {
    const c = await clientsRepo.create("OldName")
    const updated = await clientsRepo.update(Number(c.id), { name: "NewName" })
    expect(updated.name).toBe("NewName")

    const fetched = await clientsRepo.getById(Number(c.id))
    expect(fetched!.name).toBe("NewName")
  })
})
