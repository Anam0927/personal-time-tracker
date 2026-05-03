import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import type { Kysely } from "kysely"

import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ProjectsRepositoryImpl } from "../projects/repo"
import { BrowserService } from "./browser.service"
import { ClientsRepositoryImpl } from "./repo"

let db: Kysely<DB>
let cleanup: () => void
let clientsRepo: ClientsRepositoryImpl
let projectsRepo: ProjectsRepositoryImpl
let service: BrowserService

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  clientsRepo = new ClientsRepositoryImpl(db)
  projectsRepo = new ProjectsRepositoryImpl(db)
  service = new BrowserService(db)
})

afterAll(() => {
  cleanup()
})

beforeEach(async () => {
  await Promise.all([
    db.deleteFrom("pauseEvents").execute(),
    db.deleteFrom("sessionTags").execute(),
    db.deleteFrom("sessions").execute(),
    db.deleteFrom("projects").execute(),
    db.deleteFrom("clients").execute(),
  ])
})

describe("BrowserService", () => {
  it("returns empty tree when no clients exist", async () => {
    const tree = await service.getTree()

    expect(tree.clients).toHaveLength(0)
  })

  it("returns tree with clients and their projects", async () => {
    const client = await clientsRepo.create("Acme Corp")
    await projectsRepo.create({
      name: "Redesign",
      clientId: Number(client.id),
    })

    const tree = await service.getTree()

    expect(tree.clients).toHaveLength(1)
    expect(tree.clients[0]!.client.name).toBe("Acme Corp")
    expect(tree.clients[0]!.projects).toHaveLength(1)
    expect(tree.clients[0]!.projects[0]!.name).toBe("Redesign")
  })

  it("includes archived entities when includeArchived is true", async () => {
    const client = await clientsRepo.create("Old Corp")
    const project = await projectsRepo.create({
      name: "Legacy",
      clientId: Number(client.id),
    })
    await clientsRepo.archive(Number(client.id))
    await projectsRepo.archive(Number(project.id))

    const tree = await service.getTree({ includeArchived: true })

    expect(tree.clients).toHaveLength(1)
    expect(tree.clients[0]!.client.archived).toBe(1)
    expect(tree.clients[0]!.projects).toHaveLength(1)
    expect(tree.clients[0]!.projects[0]!.archived).toBe(1)
  })

  it("excludes archived entities when includeArchived is false (default)", async () => {
    // Active client + project
    const activeClient = await clientsRepo.create("Active Client")
    await projectsRepo.create({
      name: "Active Project",
      clientId: Number(activeClient.id),
    })

    // Archived client + project
    const archivedClient = await clientsRepo.create("Archived Client")
    const archivedProject = await projectsRepo.create({
      name: "Archived Project",
      clientId: Number(archivedClient.id),
    })
    await clientsRepo.archive(Number(archivedClient.id))
    await projectsRepo.archive(Number(archivedProject.id))

    const tree = await service.getTree()

    expect(tree.clients).toHaveLength(1)
    expect(tree.clients[0]!.client.name).toBe("Active Client")
    expect(tree.clients[0]!.projects).toHaveLength(1)
    expect(tree.clients[0]!.projects[0]!.name).toBe("Active Project")
  })

  it("returns a client with no projects", async () => {
    await clientsRepo.create("Empty Corp")

    const tree = await service.getTree()

    expect(tree.clients).toHaveLength(1)
    expect(tree.clients[0]!.client.name).toBe("Empty Corp")
    expect(tree.clients[0]!.projects).toHaveLength(0)
  })
})
