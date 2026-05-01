import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import type { Kysely } from "kysely"

import { ConstraintViolationError } from "@/lib/db/errors"
import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ClientsRepositoryImpl } from "../clients/repo"
import { ProjectsRepositoryImpl } from "./repo"

let db: Kysely<DB>
let cleanup: () => void

let clientsRepo: ClientsRepositoryImpl
let projectsRepo: ProjectsRepositoryImpl

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  clientsRepo = new ClientsRepositoryImpl(db)
  projectsRepo = new ProjectsRepositoryImpl(db)
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
// ProjectsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("ProjectsRepositoryImpl", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  it("create() creates project with name only", async () => {
    const project = await projectsRepo.create({ name: "Project Alpha" })
    expect(project).toBeDefined()
    expect(Number(project.id)).toBeGreaterThan(0)
    expect(project.name).toBe("Project Alpha")
    expect(project.clientId).toBeNull()
  })

  it("create() creates project with clientId", async () => {
    const client = await clientsRepo.create("Client For Project")
    const project = await projectsRepo.create({
      name: "Project Beta",
      clientId: Number(client.id),
    })
    expect(project.clientId).toBe(Number(client.id))
  })

  it("create() throws ConstraintViolationError on duplicate name", async () => {
    await projectsRepo.create({ name: "DupProject" })
    expect(projectsRepo.create({ name: "DupProject" })).rejects.toThrow(ConstraintViolationError)
  })

  it("getById() returns project by id", async () => {
    const created = await projectsRepo.create({ name: "GetById Proj" })
    const found = await projectsRepo.getById(Number(created.id))
    expect(found).not.toBeNull()
    expect(found!.name).toBe("GetById Proj")
  })

  it("getByName() returns project by name", async () => {
    await projectsRepo.create({ name: "FindMe" })
    const found = await projectsRepo.getByName("FindMe")
    expect(found).not.toBeNull()
  })

  it("list() returns non-archived by default", async () => {
    await projectsRepo.create({ name: "Visible" })
    const list = await projectsRepo.list()
    expect(list.length).toBe(1)
  })

  it("list({ clientId }) filters by client", async () => {
    const c1 = await clientsRepo.create("C1")
    const c2 = await clientsRepo.create("C2")
    await projectsRepo.create({ name: "P1", clientId: Number(c1.id) })
    await projectsRepo.create({ name: "P2", clientId: Number(c2.id) })
    const list = await projectsRepo.list({ clientId: Number(c1.id) })
    expect(list.length).toBe(1)
    expect(list[0]!.name).toBe("P1")
  })

  it("list({ includeArchived: true }) includes archived", async () => {
    const p = await projectsRepo.create({ name: "ArchivableProj" })
    await projectsRepo.archive(Number(Number(p.id)))
    const all = await projectsRepo.list({ includeArchived: true })
    expect(all.length).toBe(1)
    expect(!!all[0]!.archived).toBe(true)
  })

  it("archive() / unarchive() work correctly", async () => {
    const p = await projectsRepo.create({ name: "ToggleArchive" })
    const archived = await projectsRepo.archive(Number(Number(p.id)))
    expect(!!archived.archived).toBe(true)
    const unarchived = await projectsRepo.unarchive(Number(Number(p.id)))
    expect(!!unarchived.archived).toBe(false)
  })

  it("update() updates fields", async () => {
    const p = await projectsRepo.create({
      name: "UpdateMe",
      description: "old desc",
    })
    const updated = await projectsRepo.update(Number(p.id), {
      name: "Updated",
      description: "new desc",
      color: "#ff0000",
    })
    expect(updated.name).toBe("Updated")
    expect(updated.description).toBe("new desc")
    expect(updated.color).toBe("#ff0000")
  })

  it("ON DELETE SET NULL: when client deleted, project.clientId becomes null", async () => {
    const client = await clientsRepo.create("DeleteClient")
    const project = await projectsRepo.create({
      name: "OrphanProject",
      clientId: Number(client.id),
    })
    expect(project.clientId).toBe(Number(client.id))

    await db.deleteFrom("clients").where("id", "=", Number(client.id)).execute()

    const reloaded = await projectsRepo.getById(Number(project.id))
    expect(reloaded).not.toBeNull()
    expect(reloaded!.clientId).toBeNull()
  })
})
