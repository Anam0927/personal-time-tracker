import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import type { Kysely } from "kysely"

import { ConstraintViolationError } from "@/lib/db/errors"
import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ClientsRepositoryImpl } from "../clients/repo"
import { ProjectsRepositoryImpl } from "../projects/repo"
import { NotificationEventsRepositoryImpl } from "./notification-events.repo"
import { PauseEventsRepositoryImpl } from "./pause-events.repo"
import { SessionsRepositoryImpl } from "./sessions.repo"
import { TagsRepositoryImpl } from "./tags.repo"

let db: Kysely<DB>
let cleanup: () => void

let clientsRepo: ClientsRepositoryImpl
let projectsRepo: ProjectsRepositoryImpl
let sessionsRepo: SessionsRepositoryImpl
let pauseEventsRepo: PauseEventsRepositoryImpl
let tagsRepo: TagsRepositoryImpl
let notifEventsRepo: NotificationEventsRepositoryImpl

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  clientsRepo = new ClientsRepositoryImpl(db)
  projectsRepo = new ProjectsRepositoryImpl(db)
  sessionsRepo = new SessionsRepositoryImpl(db)
  pauseEventsRepo = new PauseEventsRepositoryImpl(db)
  tagsRepo = new TagsRepositoryImpl(db)
  notifEventsRepo = new NotificationEventsRepositoryImpl(db)
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
// SessionsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("SessionsRepositoryImpl", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  it("getById() returns session by id", async () => {
    const created = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const session = await sessionsRepo.getById(created.id)
    expect(session).not.toBeNull()
    expect(session!.status).toBe("active")
  })

  it("getById() returns null for nonexistent id", async () => {
    const session = await sessionsRepo.getById(999)
    expect(session).toBeNull()
  })

  it("listHistory() returns sessions ordered by startedAt DESC", async () => {
    const s1 = await sessionsRepo.create({
      startedAt: "2024-01-01T00:00:00.000Z",
      status: "completed",
    })
    const s2 = await sessionsRepo.create({
      startedAt: "2024-01-02T00:00:00.000Z",
      status: "completed",
    })

    const history = await sessionsRepo.listHistory()
    expect(history.length).toBe(2)
    expect(Number(history[0]!.id)).toBe(Number(s2.id))
    expect(Number(history[1]!.id)).toBe(Number(s1.id))
  })

  it("listHistory({ limit }) limits results", async () => {
    await sessionsRepo.create({ startedAt: "2024-01-01T00:00:00.000Z", status: "completed" })
    await sessionsRepo.create({ startedAt: "2024-01-02T00:00:00.000Z", status: "completed" })
    const limited = await sessionsRepo.listHistory({ limit: 1 })
    expect(limited.length).toBe(1)
  })

  it("listHistory({ offset }) paginates", async () => {
    const s1 = await sessionsRepo.create({
      startedAt: "2024-01-01T00:00:00.000Z",
      status: "completed",
    })
    const _s2 = await sessionsRepo.create({
      startedAt: "2024-01-02T00:00:00.000Z",
      status: "completed",
    })
    // SQLite requires LIMIT when using OFFSET
    const offset = await sessionsRepo.listHistory({ offset: 1, limit: 10 })
    expect(offset.length).toBe(1)
    expect(Number(offset[0]!.id)).toBe(Number(s1.id))
  })

  it("updateNote() updates note field", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
      note: "initial",
    })
    const updated = await sessionsRepo.updateNote({
      sessionId: session.id,
      note: "revised note",
    })
    expect(updated.note).toBe("revised note")
  })

  it("transition() active→paused works and does not set endedAt", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "active",
      to: "paused",
    })
    expect(result.variant).toBe("transitioned")
    if (result.variant === "transitioned") {
      expect(result.session.status).toBe("paused")
      expect(result.session.endedAt).toBeNull()
    }
  })

  it("transition() active→completed sets endedAt", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "active",
      to: "completed",
    })
    expect(result.variant).toBe("transitioned")
    if (result.variant === "transitioned") {
      expect(result.session.status).toBe("completed")
      expect(result.session.endedAt).not.toBeNull()
    }
  })

  it("transition() paused→active works and does not set endedAt", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "paused",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "paused",
      to: "active",
    })
    expect(result.variant).toBe("transitioned")
    if (result.variant === "transitioned") {
      expect(result.session.status).toBe("active")
      expect(result.session.endedAt).toBeNull()
    }
  })

  it("transition() paused→completed sets endedAt", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "paused",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "paused",
      to: "completed",
    })
    expect(result.variant).toBe("transitioned")
    if (result.variant === "transitioned") {
      expect(result.session.status).toBe("completed")
      expect(result.session.endedAt).not.toBeNull()
    }
  })

  it("transition() invalid transition returns invalidTransition variant", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "completed",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "completed",
      to: "active",
    })
    expect(result.variant).toBe("invalidTransition")
    if (result.variant === "invalidTransition") {
      expect(result.from).toBe("completed")
      expect(result.to).toBe("active")
    }
  })

  it("transition() returns notFound for nonexistent sessionId", async () => {
    const result = await sessionsRepo.transition({
      sessionId: 99999,
      from: "active",
      to: "paused",
    })
    expect(result.variant).toBe("notFound")
  })

  it("transition() returns staleState when from does not match actual status", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const result = await sessionsRepo.transition({
      sessionId: session.id,
      from: "paused",
      to: "active",
    })
    expect(result.variant).toBe("staleState")
    if (result.variant === "staleState") {
      expect(result.expected).toBe("paused")
      expect(result.actual).toBe("active")
    }
  })

  it("setThreshold() sets thresholdMinutes", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const updated = await sessionsRepo.setThreshold({
      sessionId: session.id,
      minutes: 45,
    })
    expect(updated.thresholdMinutes).toBe(45)
  })

  it("setEndedAt() sets endedAt", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const endTime = new Date().toISOString()
    const updated = await sessionsRepo.setEndedAt({
      sessionId: session.id,
      endedAt: endTime,
    })
    expect(updated.endedAt).toBe(endTime)
  })

  it("setProject() sets projectId", async () => {
    const client = await clientsRepo.create("PClient")
    const project = await projectsRepo.create({
      name: "SessionProj",
      clientId: Number(client.id),
    })

    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const updated = await sessionsRepo.setProject({
      sessionId: session.id,
      projectId: Number(project.id),
    })
    expect(updated.projectId).toBe(Number(project.id))
  })

  it("setProject(null) clears projectId", async () => {
    const project = await projectsRepo.create({ name: "ClearProj" })
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
      projectId: Number(project.id),
    })
    const cleared = await sessionsRepo.setProject({
      sessionId: session.id,
      projectId: null,
    })
    expect(cleared.projectId).toBeNull()
  })

  it("ON DELETE SET NULL: when project deleted, session.projectId becomes null", async () => {
    const client = await clientsRepo.create("OrphanSessionClient")
    const project = await projectsRepo.create({
      name: "OrphanSessionProj",
      clientId: Number(client.id),
    })

    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
      projectId: Number(project.id),
    })
    expect(session.projectId).toBe(Number(project.id))

    await db.deleteFrom("projects").where("id", "=", Number(project.id)).execute()

    const reloaded = await sessionsRepo.getById(session.id)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.projectId).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// PauseEventsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("PauseEventsRepositoryImpl", () => {
  let sessionId: number

  beforeEach(async () => {
    await cleanAllTables()
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    sessionId = session.id
  })

  it("create() creates pause event, returns row with id", async () => {
    const event = await pauseEventsRepo.create({ sessionId })
    expect(event).toBeDefined()
    expect(Number(event.id)).toBeGreaterThan(0)
    expect(event.sessionId).toBe(sessionId)
    expect(event.reason).toBeNull()
    expect(event.resumedAt).toBeNull()
  })

  it("create() can create with reason", async () => {
    const event = await pauseEventsRepo.create({
      sessionId,
      reason: "user paused",
    })
    expect(event.reason).toBe("user paused")
  })

  it("resume() sets resumedAt", async () => {
    const event = await pauseEventsRepo.create({ sessionId })
    const resumed = await pauseEventsRepo.resume(Number(event.id))
    expect(resumed.resumedAt).not.toBeNull()
  })

  it("resume() returns updated row", async () => {
    const event = await pauseEventsRepo.create({ sessionId })
    const resumed = await pauseEventsRepo.resume(Number(event.id))
    expect(Number(resumed.id)).toBe(Number(event.id))
    expect(resumed.sessionId).toBe(sessionId)
  })

  it("getBySessionId() returns all pause events for a session", async () => {
    const first = await pauseEventsRepo.create({ sessionId, reason: "first" })
    await pauseEventsRepo.resume(Number(first.id))
    await pauseEventsRepo.create({ sessionId, reason: "second" })
    const events = await pauseEventsRepo.getBySessionId(sessionId)
    expect(events.length).toBe(2)
  })

  it("getBySessionId() returns empty array when none exist", async () => {
    const events = await pauseEventsRepo.getBySessionId(sessionId)
    expect(events).toEqual([])
  })

  it("getBySessionIds() returns all pause events for multiple sessions", async () => {
    const session2 = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "paused",
    })

    const e1 = await pauseEventsRepo.create({ sessionId })
    await pauseEventsRepo.resume(Number(e1.id))
    await pauseEventsRepo.create({ sessionId })
    await pauseEventsRepo.create({ sessionId: Number(session2.id) })

    const events = await pauseEventsRepo.getBySessionIds([sessionId, Number(session2.id)])
    expect(events.length).toBe(3)
  })

  it("getBySessionIds() returns empty array when no matches", async () => {
    const events = await pauseEventsRepo.getBySessionIds([99999])
    expect(events).toEqual([])
  })

  it("getBySessionIds() returns empty array for empty input", async () => {
    const events = await pauseEventsRepo.getBySessionIds([])
    expect(events).toEqual([])
  })

  it("getActivePause() returns an unresolved pause event", async () => {
    const first = await pauseEventsRepo.create({
      sessionId,
      reason: "first",
    })
    await pauseEventsRepo.resume(Number(first.id))

    const second = await pauseEventsRepo.create({
      sessionId,
      reason: "second",
    })

    const active = await pauseEventsRepo.getActivePause(sessionId)
    expect(active).not.toBeNull()
    expect(active!.resumedAt).toBeNull()
    expect(Number(active!.id)).toBe(Number(second.id))

    // Resume all events
    await pauseEventsRepo.resume(Number(second.id))

    const activeAfter = await pauseEventsRepo.getActivePause(sessionId)
    expect(activeAfter).toBeNull()
  })

  it("getActivePause() returns null when all are resolved", async () => {
    const event = await pauseEventsRepo.create({ sessionId })
    await pauseEventsRepo.resume(Number(event.id))
    const active = await pauseEventsRepo.getActivePause(sessionId)
    expect(active).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// TagsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("TagsRepositoryImpl", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  it("create() creates tag", async () => {
    const tag = await tagsRepo.create("urgent")
    expect(tag).toBeDefined()
    expect(Number(tag.id)).toBeGreaterThan(0)
    expect(tag.name).toBe("urgent")
  })

  it("create() throws ConstraintViolationError on duplicate name", async () => {
    await tagsRepo.create("unique")
    expect(tagsRepo.create("unique")).rejects.toThrow(ConstraintViolationError)
  })

  it("getByName() returns tag by name", async () => {
    const created = await tagsRepo.create("bug")
    const found = await tagsRepo.getByName("bug")
    expect(found).not.toBeNull()
    expect(Number(found!.id)).toBe(created.id)
  })

  it("list() returns all tags", async () => {
    await tagsRepo.create("a")
    await tagsRepo.create("b")
    const list = await tagsRepo.list()
    expect(list.length).toBe(2)
  })

  it("delete() removes tag", async () => {
    const tag = await tagsRepo.create("delete-me")
    await tagsRepo.delete(Number(tag.id))
    const found = await tagsRepo.getByName("delete-me")
    expect(found).toBeNull()
  })

  it("addToSession() / removeFromSession() manage session-tag associations", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const tag = await tagsRepo.create("feature")

    await tagsRepo.addToSession({
      sessionId: session.id,
      tagId: Number(tag.id),
    })
    let sessionTags = await tagsRepo.getSessionTags(session.id)
    expect(sessionTags.length).toBe(1)
    expect(sessionTags[0]!.name).toBe("feature")

    await tagsRepo.removeFromSession({
      sessionId: session.id,
      tagId: Number(tag.id),
    })
    sessionTags = await tagsRepo.getSessionTags(session.id)
    expect(sessionTags.length).toBe(0)
  })

  it("getSessionTags() returns tags for a session", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const t1 = await tagsRepo.create("frontend")
    const t2 = await tagsRepo.create("backend")
    await tagsRepo.addToSession({
      sessionId: session.id,
      tagId: Number(t1.id),
    })
    await tagsRepo.addToSession({
      sessionId: session.id,
      tagId: Number(t2.id),
    })

    const tags = await tagsRepo.getSessionTags(session.id)
    expect(tags.length).toBe(2)
  })

  it("addToSession() throws on duplicate (sessionId, tagId) pair", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const tag = await tagsRepo.create("multi")
    await tagsRepo.addToSession({
      sessionId: session.id,
      tagId: Number(tag.id),
    })
    // The unique constraint on (sessionId, tagId) rejects duplicates
    expect(
      tagsRepo.addToSession({
        sessionId: session.id,
        tagId: Number(tag.id),
      }),
    ).rejects.toThrow(/UNIQUE|constraint/i)
  })

  it("CASCADE: when session is deleted, sessionTags entries are removed", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    const tag = await tagsRepo.create("cascade-tag")
    await tagsRepo.addToSession({
      sessionId: session.id,
      tagId: Number(tag.id),
    })

    const before = await tagsRepo.getSessionTags(session.id)
    expect(before.length).toBe(1)

    await db.deleteFrom("sessions").where("id", "=", session.id).execute()

    const after = await tagsRepo.getSessionTags(session.id)
    expect(after.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// NotificationEventsRepositoryImpl
// ─────────────────────────────────────────────────────────────
describe("NotificationEventsRepositoryImpl", () => {
  let sessionId: number

  beforeEach(async () => {
    await cleanAllTables()
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })
    sessionId = session.id
  })

  it("create() creates notification event with thresholdReachedAt", async () => {
    const now = new Date().toISOString()
    const event = await notifEventsRepo.create({
      sessionId,
      thresholdMinutes: 30,
      thresholdReachedAt: now,
    })
    expect(event).toBeDefined()
    expect(Number(event.id)).toBeGreaterThan(0)
    expect(event.sessionId).toBe(sessionId)
    expect(event.thresholdMinutes).toBe(30)
    expect(event.thresholdReachedAt).toBe(now)
  })

  it("markSent() sets notificationSentAt + notificationType", async () => {
    const event = await notifEventsRepo.create({
      sessionId,
      thresholdMinutes: 60,
      thresholdReachedAt: new Date().toISOString(),
    })
    const sent = await notifEventsRepo.markSent({
      id: Number(event.id),
      type: "email",
    })
    expect(sent.notificationSentAt).not.toBeNull()
    expect(sent.notificationType).toBe("email")
  })

  it("getBySessionId() returns events for a session", async () => {
    await notifEventsRepo.create({
      sessionId,
      thresholdMinutes: 30,
      thresholdReachedAt: new Date().toISOString(),
    })
    await notifEventsRepo.create({
      sessionId,
      thresholdMinutes: 60,
      thresholdReachedAt: new Date().toISOString(),
    })
    const events = await notifEventsRepo.getBySessionId(sessionId)
    expect(events.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
// SessionsRepositoryImpl (active session)
// ─────────────────────────────────────────────────────────────
describe("SessionsRepositoryImpl (active session)", () => {
  beforeEach(async () => {
    await cleanAllTables()
  })

  it("getActive() returns null when no active/paused session", async () => {
    const active = await sessionsRepo.getActive()
    expect(active).toBeNull()
  })

  it("getActive() returns active session with projectName, clientName", async () => {
    const client = await clientsRepo.create("ActiveClient")
    const project = await projectsRepo.create({
      name: "ActiveProject",
      clientId: Number(client.id),
    })

    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
      projectId: Number(project.id),
    })

    const active = await sessionsRepo.getActive()
    expect(active).not.toBeNull()
    expect(active!.id).toBe(session.id)
    expect(active!.status).toBe("active")
    expect(active!.projectName).toBe("ActiveProject")
    expect(active!.clientName).toBe("ActiveClient")
  })

  it("getActive() returns paused session", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "paused",
    })

    await pauseEventsRepo.create({
      sessionId: session.id,
    })

    const active = await sessionsRepo.getActive()
    expect(active!.id).toBe(session.id)
    expect(active!.status).toBe("paused")
  })

  it("getActive() computes elapsedMinutes for active session", async () => {
    await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
    })

    const active = await sessionsRepo.getActive()
    expect(active).not.toBeNull()
    expect(typeof active!.elapsedMinutes).toBe("number")
    expect(active!.elapsedMinutes).toBeGreaterThanOrEqual(0)
  })

  it("getActive() computes elapsedMinutes for paused session", async () => {
    const session = await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "paused",
    })

    await pauseEventsRepo.create({
      sessionId: session.id,
    })

    const active = await sessionsRepo.getActive()
    expect(active).not.toBeNull()
    expect(typeof active!.elapsedMinutes).toBe("number")
    expect(active!.elapsedMinutes).toBeGreaterThanOrEqual(0)
  })

  it("getActiveSessionRow() returns raw Sessions row for active session", async () => {
    await sessionsRepo.create({
      startedAt: new Date().toISOString(),
      status: "active",
      note: "raw row",
    })

    const row = await sessionsRepo.getActiveSessionRow()
    expect(row).not.toBeNull()
    expect(row!.status).toBe("active")
    expect(row!.note).toBe("raw row")
  })

  it("getActiveSessionRow() returns null when no active session", async () => {
    const row = await sessionsRepo.getActiveSessionRow()
    expect(row).toBeNull()
  })
})
