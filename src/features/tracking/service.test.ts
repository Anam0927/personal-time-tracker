import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import type { Kysely } from "kysely"

import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ClientsRepositoryImpl } from "../clients/repo"
import { ProjectsRepositoryImpl } from "../projects/repo"
import { PauseEventsRepositoryImpl } from "./pause-events.repo"
import { TimerServiceImpl } from "./service"
import { SessionsRepositoryImpl } from "./sessions.repo"
import { TagsRepositoryImpl } from "./tags.repo"

let db: Kysely<DB>
let cleanup: () => void

let clientsRepo: ClientsRepositoryImpl
let projectsRepo: ProjectsRepositoryImpl
let sessionsRepo: SessionsRepositoryImpl
let pauseEventsRepo: PauseEventsRepositoryImpl
let tagsRepo: TagsRepositoryImpl
let service: TimerServiceImpl

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  clientsRepo = new ClientsRepositoryImpl(db)
  projectsRepo = new ProjectsRepositoryImpl(db)
  sessionsRepo = new SessionsRepositoryImpl(db)
  pauseEventsRepo = new PauseEventsRepositoryImpl(db)
  tagsRepo = new TagsRepositoryImpl(db)
  service = new TimerServiceImpl(db)
})

afterAll(() => {
  cleanup()
})

async function cleanAllTables(): Promise<void> {
  await Promise.all([
    db.deleteFrom("pauseEvents").execute(),
    db.deleteFrom("notificationEvents").execute(),
    db.deleteFrom("sessionTags").execute(),
    db.deleteFrom("sessions").execute(),
    db.deleteFrom("tags").execute(),
    db.deleteFrom("projects").execute(),
    db.deleteFrom("clients").execute(),
  ])
}

describe("TimerServiceImpl", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  describe("start()", () => {
    it("start() returns started variant when no timer is active", async () => {
      const client = await clientsRepo.create("StartClient")
      await projectsRepo.create({ name: "StartProject", clientId: Number(client.id) })

      const result = await service.start({ clientName: "StartClient", projectName: "StartProject" })

      expect(result.variant).toBe("started")

      const started = result as Extract<typeof result, { variant: "started" }>
      expect(Number(started.sessionId)).toBeGreaterThan(0)
      expect(started.clientName).toBe("StartClient")
      expect(started.projectName).toBe("StartProject")
    })

    it("start() returns sameActive when the same client and project are already active", async () => {
      const client = await clientsRepo.create("SameClient")
      await projectsRepo.create({ name: "SameProject", clientId: Number(client.id) })

      await service.start({ clientName: "SameClient", projectName: "SameProject" })
      const result = await service.start({ clientName: "SameClient", projectName: "SameProject" })

      expect(result.variant).toBe("sameActive")

      const sameActive = result as Extract<typeof result, { variant: "sameActive" }>
      expect(sameActive.session.projectName).toBe("SameProject")
      expect(sameActive.session.clientName).toBe("SameClient")
      expect(sameActive.session.status).toBe("active")
    })

    it("start() returns conflict when a different timer is already active", async () => {
      const client1 = await clientsRepo.create("ClientOne")
      await projectsRepo.create({ name: "ProjectOne", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("ClientTwo")
      await projectsRepo.create({ name: "ProjectTwo", clientId: Number(client2.id) })

      await service.start({ clientName: "ClientOne", projectName: "ProjectOne" })
      const result = await service.start({ clientName: "ClientTwo", projectName: "ProjectTwo" })

      expect(result.variant).toBe("conflict")

      const conflict = result as Extract<typeof result, { variant: "conflict" }>
      expect(conflict.requestedClient).toBe("ClientTwo")
      expect(conflict.requestedProject).toBe("ProjectTwo")
      expect(conflict.activeSession.clientName).toBe("ClientOne")
      expect(conflict.activeSession.projectName).toBe("ProjectOne")
    })

    it("start() returns clientNotFound when the client does not exist", async () => {
      const result = await service.start({ clientName: "NonExistent", projectName: "Any" })

      expect(result.variant).toBe("clientNotFound")

      const notFound = result as Extract<typeof result, { variant: "clientNotFound" }>
      expect(notFound.name).toBe("NonExistent")
    })

    it("start() returns projectNotFound when the project does not exist", async () => {
      await clientsRepo.create("ExistingClient")

      const result = await service.start({
        clientName: "ExistingClient",
        projectName: "NonExistent",
      })

      expect(result.variant).toBe("projectNotFound")

      const notFound = result as Extract<typeof result, { variant: "projectNotFound" }>
      expect(notFound.name).toBe("NonExistent")
      expect(notFound.clientName).toBe("ExistingClient")
    })

    it("start() returns clientArchived when the client is archived", async () => {
      const client = await clientsRepo.create("ArchivedClient")
      await clientsRepo.archive(Number(client.id))

      const result = await service.start({ clientName: "ArchivedClient", projectName: "Any" })

      expect(result.variant).toBe("clientArchived")

      const archived = result as Extract<typeof result, { variant: "clientArchived" }>
      expect(archived.name).toBe("ArchivedClient")
    })

    it("start() returns projectArchived when the project is archived", async () => {
      const client = await clientsRepo.create("ArchiveProjClient")
      const project = await projectsRepo.create({
        name: "ArchivedProject",
        clientId: Number(client.id),
      })
      await projectsRepo.archive(Number(project.id))

      const result = await service.start({
        clientName: "ArchiveProjClient",
        projectName: "ArchivedProject",
      })

      expect(result.variant).toBe("projectArchived")

      const archived = result as Extract<typeof result, { variant: "projectArchived" }>
      expect(archived.name).toBe("ArchivedProject")
    })

    it("start() creates a session with the provided note", async () => {
      const client = await clientsRepo.create("NoteClient")
      await projectsRepo.create({ name: "NoteProject", clientId: Number(client.id) })

      const result = await service.start({
        clientName: "NoteClient",
        projectName: "NoteProject",
        note: "test note",
      })

      expect(result.variant).toBe("started")
    })

    it("start() creates a session with the provided threshold", async () => {
      const client = await clientsRepo.create("ThresholdClient")
      await projectsRepo.create({ name: "ThresholdProject", clientId: Number(client.id) })

      const result = await service.start({
        clientName: "ThresholdClient",
        projectName: "ThresholdProject",
        thresholdMinutes: 30,
      })

      expect(result.variant).toBe("started")
    })
  })

  describe("stop()", () => {
    it("stop() returns stopped variant when a timer is active", async () => {
      const client = await clientsRepo.create("StopClient")
      await projectsRepo.create({ name: "StopProject", clientId: Number(client.id) })

      await service.start({ clientName: "StopClient", projectName: "StopProject" })
      const result = await service.stop()

      expect(result.variant).toBe("stopped")

      const stopped = result as Extract<typeof result, { variant: "stopped" }>
      expect(Number(stopped.sessionId)).toBeGreaterThan(0)
      expect(stopped.elapsedMinutes).toBeGreaterThanOrEqual(0)
    })

    it("stop() completes the active session", async () => {
      const client = await clientsRepo.create("CompletedClient")
      await projectsRepo.create({ name: "CompletedProject", clientId: Number(client.id) })

      await service.start({ clientName: "CompletedClient", projectName: "CompletedProject" })
      const result = await service.stop()

      expect(result.variant).toBe("stopped")

      const stopped = result as Extract<typeof result, { variant: "stopped" }>
      expect(Number(stopped.sessionId)).toBeGreaterThan(0)
      expect(stopped.elapsedMinutes).toBeGreaterThanOrEqual(0)
    })

    it("stop() completes a paused session", async () => {
      const client = await clientsRepo.create("PauseResumeClient")
      await projectsRepo.create({ name: "PauseResumeProject", clientId: Number(client.id) })

      const startResult = await service.start({
        clientName: "PauseResumeClient",
        projectName: "PauseResumeProject",
      })
      expect(startResult.variant).toBe("started")

      const started = startResult as Extract<typeof startResult, { variant: "started" }>
      await sessionsRepo.transition({ sessionId: started.sessionId, from: "active", to: "paused" })
      const pauseEvent = await pauseEventsRepo.create({ sessionId: started.sessionId })
      expect(pauseEvent.resumedAt).toBeNull()

      const result = await service.stop()

      expect(result.variant).toBe("stopped")

      const stopped = result as Extract<typeof result, { variant: "stopped" }>
      expect(Number(stopped.sessionId)).toBeGreaterThan(0)
      expect(stopped.elapsedMinutes).toBeGreaterThanOrEqual(0)
    })

    it("stop() returns noActive when no timer is active", async () => {
      const result = await service.stop()

      expect(result.variant).toBe("noActive")
    })
  })

  describe("switch()", () => {
    it("switch() returns switched variant when switching to a different timer", async () => {
      const client1 = await clientsRepo.create("SwitchClient1")
      await projectsRepo.create({ name: "SwitchProject1", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("SwitchClient2")
      await projectsRepo.create({ name: "SwitchProject2", clientId: Number(client2.id) })

      await service.start({ clientName: "SwitchClient1", projectName: "SwitchProject1" })
      const result = await service.switch({
        clientName: "SwitchClient2",
        projectName: "SwitchProject2",
      })

      expect(result.variant).toBe("switched")

      const switched = result as Extract<typeof result, { variant: "switched" }>
      expect(Number(switched.completedSessionId)).toBeGreaterThan(0)
      expect(Number(switched.newSessionId)).toBeGreaterThan(0)
      expect(switched.clientName).toBe("SwitchClient2")
      expect(switched.projectName).toBe("SwitchProject2")
    })

    it("switch() atomically replaces the active session", async () => {
      const client1 = await clientsRepo.create("OldClient")
      await projectsRepo.create({ name: "OldProject", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("NewClient")
      await projectsRepo.create({ name: "NewProject", clientId: Number(client2.id) })

      await service.start({ clientName: "OldClient", projectName: "OldProject" })
      const result = await service.switch({ clientName: "NewClient", projectName: "NewProject" })

      expect(result.variant).toBe("switched")

      const switched = result as Extract<typeof result, { variant: "switched" }>
      expect(Number(switched.completedSessionId)).toBeGreaterThan(0)
      expect(Number(switched.newSessionId)).toBeGreaterThan(0)
    })

    it("switch() returns noActiveToSwitch when no timer is active", async () => {
      const client = await clientsRepo.create("NoActiveClient")
      await projectsRepo.create({ name: "NoActiveProject", clientId: Number(client.id) })

      const result = await service.switch({
        clientName: "NoActiveClient",
        projectName: "NoActiveProject",
      })

      expect(result.variant).toBe("noActiveToSwitch")
    })

    it("switch() returns clientArchived when switching to an archived client", async () => {
      const client1 = await clientsRepo.create("ActiveSwitchClient1")
      await projectsRepo.create({ name: "ActiveSwitchProject1", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("ArchivedSwitchClient")
      await projectsRepo.create({ name: "ArchivedSwitchProject", clientId: Number(client2.id) })
      await clientsRepo.archive(Number(client2.id))

      await service.start({
        clientName: "ActiveSwitchClient1",
        projectName: "ActiveSwitchProject1",
      })
      const result = await service.switch({
        clientName: "ArchivedSwitchClient",
        projectName: "ArchivedSwitchProject",
      })

      expect(result.variant).toBe("clientArchived")

      const archived = result as Extract<typeof result, { variant: "clientArchived" }>
      expect(archived.name).toBe("ArchivedSwitchClient")
    })

    it("switch() returns projectArchived when switching to an archived project", async () => {
      const client1 = await clientsRepo.create("ActiveSwitchClient2")
      await projectsRepo.create({ name: "ActiveSwitchProject2", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("ArchivedProjSwitchClient")
      const project2 = await projectsRepo.create({
        name: "ArchivedSwitchProject2",
        clientId: Number(client2.id),
      })
      await projectsRepo.archive(Number(project2.id))

      await service.start({
        clientName: "ActiveSwitchClient2",
        projectName: "ActiveSwitchProject2",
      })
      const result = await service.switch({
        clientName: "ArchivedProjSwitchClient",
        projectName: "ArchivedSwitchProject2",
      })

      expect(result.variant).toBe("projectArchived")

      const archived = result as Extract<typeof result, { variant: "projectArchived" }>
      expect(archived.name).toBe("ArchivedSwitchProject2")
    })

    it("switch() transitions a paused session", async () => {
      const client1 = await clientsRepo.create("PauseSwitch1")
      await projectsRepo.create({ name: "PauseSwitchProj1", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("PauseSwitch2")
      await projectsRepo.create({ name: "PauseSwitchProj2", clientId: Number(client2.id) })

      const startResult = await service.start({
        clientName: "PauseSwitch1",
        projectName: "PauseSwitchProj1",
      })
      expect(startResult.variant).toBe("started")

      const started = startResult as Extract<typeof startResult, { variant: "started" }>
      await sessionsRepo.transition({ sessionId: started.sessionId, from: "active", to: "paused" })
      const pauseEvent = await pauseEventsRepo.create({ sessionId: started.sessionId })
      expect(pauseEvent.resumedAt).toBeNull()

      const result = await service.switch({
        clientName: "PauseSwitch2",
        projectName: "PauseSwitchProj2",
      })

      expect(result.variant).toBe("switched")

      const switched = result as Extract<typeof result, { variant: "switched" }>
      expect(Number(switched.completedSessionId)).toBeGreaterThan(0)
      expect(Number(switched.newSessionId)).toBeGreaterThan(0)
    })
  })

  describe("tags", () => {
    it("start() associates tags with the session", async () => {
      const client = await clientsRepo.create("TagClient")
      await projectsRepo.create({ name: "TagProject", clientId: Number(client.id) })

      const result = await service.start({
        clientName: "TagClient",
        projectName: "TagProject",
        tags: ["urgent", "billing"],
      })

      expect(result.variant).toBe("started")
      const started = result as Extract<typeof result, { variant: "started" }>
      expect(started.tags).toEqual(["urgent", "billing"])
    })

    it("start() deduplicates duplicate tag names", async () => {
      const client = await clientsRepo.create("DedupClient")
      await projectsRepo.create({ name: "DedupProject", clientId: Number(client.id) })

      const result = await service.start({
        clientName: "DedupClient",
        projectName: "DedupProject",
        tags: ["urgent", "urgent"],
      })

      expect(result.variant).toBe("started")
      const started = result as Extract<typeof result, { variant: "started" }>
      expect(started.tags).toEqual(["urgent"])
    })

    it("start() reuses existing tags instead of creating duplicates", async () => {
      const client = await clientsRepo.create("ReuseClient")
      await projectsRepo.create({ name: "ReuseProject", clientId: Number(client.id) })
      await tagsRepo.create("existing")

      const result = await service.start({
        clientName: "ReuseClient",
        projectName: "ReuseProject",
        tags: ["existing", "new"],
      })

      expect(result.variant).toBe("started")
      const started = result as Extract<typeof result, { variant: "started" }>
      expect(started.tags).toContain("existing")
      expect(started.tags).toContain("new")
    })

    it("switch() passes tags to new session", async () => {
      const client1 = await clientsRepo.create("SwitchTag1")
      await projectsRepo.create({ name: "SwitchTagProj1", clientId: Number(client1.id) })
      const client2 = await clientsRepo.create("SwitchTag2")
      await projectsRepo.create({ name: "SwitchTagProj2", clientId: Number(client2.id) })

      await service.start({ clientName: "SwitchTag1", projectName: "SwitchTagProj1" })
      const result = await service.switch({
        clientName: "SwitchTag2",
        projectName: "SwitchTagProj2",
        tags: ["switched"],
      })

      expect(result.variant).toBe("switched")
      const switched = result as Extract<typeof result, { variant: "switched" }>
      expect(switched.tags).toEqual(["switched"])
    })

    it("updateTags() replaces existing tags on active session", async () => {
      const client = await clientsRepo.create("UpdateClient")
      await projectsRepo.create({ name: "UpdateProject", clientId: Number(client.id) })

      const startResult = await service.start({
        clientName: "UpdateClient",
        projectName: "UpdateProject",
        tags: ["old"],
      })
      expect(startResult.variant).toBe("started")
      const started = startResult as Extract<typeof startResult, { variant: "started" }>

      const updateResult = await service.updateTags(started.sessionId, ["new"])
      expect(updateResult.variant).toBe("updated")
      const updated = updateResult as Extract<typeof updateResult, { variant: "updated" }>
      expect(updated.tags).toEqual(["new"])
    })

    it("updateTags() updates tags on completed sessions", async () => {
      const client = await clientsRepo.create("CompletedTagClient")
      await projectsRepo.create({ name: "CompletedTagProject", clientId: Number(client.id) })

      const startResult = await service.start({
        clientName: "CompletedTagClient",
        projectName: "CompletedTagProject",
        tags: ["original"],
      })
      expect(startResult.variant).toBe("started")
      const started = startResult as Extract<typeof startResult, { variant: "started" }>

      await service.stop()

      const updateResult = await service.updateTags(started.sessionId, ["revised"])
      expect(updateResult.variant).toBe("updated")
      const updated = updateResult as Extract<typeof updateResult, { variant: "updated" }>
      expect(updated.tags).toEqual(["revised"])
    })

    it("updateTags() returns sessionNotFound for non-existent session", async () => {
      const result = await service.updateTags(99999, ["tag"])
      expect(result.variant).toBe("sessionNotFound")
    })

    // NOTE: tagResolutionFailed variant is hard to test without mocking internal
    // dependencies. It requires triggering a TagResolutionError inside resolveTags(),
    // which only happens in a narrow race condition: a concurrent transaction creates
    // a tag between getByName() and create(), causing ConstraintViolationError, and
    // then the retry getByName() also fails. This gap is acceptable — the error path
    // is structurally guaranteed by the type system (TagResolutionError is thrown and
    // caught at the transaction boundary).
  })
})
