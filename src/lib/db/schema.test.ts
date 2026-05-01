import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { sql } from "kysely"

import type { DB } from "./types"

const testDir = path.join(os.tmpdir(), `time-tracker-schema-test-${Date.now()}`)

describe("schema validation", () => {
  let db: import("kysely").Kysely<DB>

  beforeAll(async () => {
    // Use a mock module to redirect xdgData to the temp directory
    // Must be set before importing modules that use xdg-basedir
    const { mock } = await import("bun:test")
    mock.module("xdg-basedir", () => ({ xdgData: testDir }))

    // Apply migrations to the test database
    const migrateModule = await import("./migrate")

    // Run migrations
    const results = await migrateModule.runMigrations()
    expect(results).toBeDefined()
    expect(results!.length).toBeGreaterThan(0)
    for (const result of results!) {
      expect(result.status).toBe("Success")
    }

    // Get the db instance
    const dbModule = await import("./db")
    db = dbModule.initDb()
  })

  afterAll(() => {
    // Clean up the test database
    if (db) {
      db.destroy()
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it("has all 8 tables", async () => {
    const result = await sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'kysely_%' ORDER BY name
    `.execute(db)

    const tableNames = result.rows.map((row) => row.name)
    expect(tableNames.length).toBe(8)
    expect(tableNames).toContain("app_state")
    expect(tableNames).toContain("clients")
    expect(tableNames).toContain("notification_events")
    expect(tableNames).toContain("pause_events")
    expect(tableNames).toContain("projects")
    expect(tableNames).toContain("session_tags")
    expect(tableNames).toContain("sessions")
    expect(tableNames).toContain("tags")
  })

  it("enforces foreign key constraint: projects.client_id references clients.id", async () => {
    // Insert a client
    await db.insertInto("clients").values({ name: "TestClient" }).execute()

    // Insert a project referencing the client — should succeed
    const { insertId: projectId } = await db
      .insertInto("projects")
      .values({ name: "TestProject", clientId: 1 })
      .executeTakeFirst()

    expect(projectId).toBeDefined()
    expect(Number(projectId)).toBe(1)
  })

  it("rejects project with nonexistent client_id", async () => {
    // Attempt to insert a project with a client_id that doesn't exist
    const promise = db
      .insertInto("projects")
      .values({ name: "OrphanProject", clientId: 999 })
      .execute()

    // SQLite foreign key violation should throw with "FOREIGN KEY constraint failed"
    expect(promise).rejects.toThrow(/FOREIGN KEY|constraint/i)
  })

  it("sets project.client_id to NULL when referenced client is deleted", async () => {
    // Insert a client
    await db.insertInto("clients").values({ name: "ClientForSetNull" }).execute()

    // Insert a project referencing the client
    const { insertId: projectId } = await db
      .insertInto("projects")
      .values({ name: "ProjectForSetNull", clientId: 2 })
      .executeTakeFirst()

    expect(projectId).toBeDefined()
    const pid = Number(projectId)

    // Delete the client — project's client_id should be SET NULL
    await db.deleteFrom("clients").where("id", "=", 2).execute()

    // Verify the project's client_id is now NULL
    const project = await db
      .selectFrom("projects")
      .selectAll()
      .where("id", "=", pid)
      .executeTakeFirst()

    expect(project).toBeDefined()
    expect(project!.clientId).toBeNull()
  })

  it("sets session.project_id to NULL when referenced project is deleted", async () => {
    // Insert a client
    await db.insertInto("clients").values({ name: "ClientForSessionSetNull" }).execute()

    // Insert a project referencing the client
    await db
      .insertInto("projects")
      .values({ name: "ProjectForSessionSetNull", clientId: 3 })
      .execute()

    // Insert a session referencing the project
    const { insertId: sessionId } = await db
      .insertInto("sessions")
      .values({
        projectId: 1,
        startedAt: new Date().toISOString(),
        status: "active",
      })
      .executeTakeFirst()

    expect(sessionId).toBeDefined()
    const sid = Number(sessionId)

    // Delete the project — session's project_id should be SET NULL
    await db.deleteFrom("projects").where("id", "=", 1).execute()

    // Verify the session's project_id is now NULL
    const session = await db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", sid)
      .executeTakeFirst()

    expect(session).toBeDefined()
    expect(session!.projectId).toBeNull()

    // Clean up: mark session as completed to free the active slot for subsequent tests
    await db.updateTable("sessions").set({ status: "completed" }).where("id", "=", sid).execute()
  })

  it("enforces ON DELETE CASCADE for session_tags", async () => {
    // Insert a session
    const { insertId: sessionId } = await db
      .insertInto("sessions")
      .values({
        startedAt: new Date().toISOString(),
        status: "active",
      })
      .executeTakeFirst()

    expect(sessionId).toBeDefined()
    const sid = Number(sessionId)

    // Insert a tag
    const { insertId: tagId } = await db
      .insertInto("tags")
      .values({ name: "TestTag" })
      .executeTakeFirst()

    expect(tagId).toBeDefined()
    const tid = Number(tagId)

    // Join them in session_tags
    await db.insertInto("sessionTags").values({ sessionId: sid, tagId: tid }).execute()

    // Verify the join exists
    const joinBefore = await db
      .selectFrom("sessionTags")
      .selectAll()
      .where("sessionId", "=", sid)
      .execute()

    expect(joinBefore).toHaveLength(1)

    // Delete the session — should cascade delete the join
    await db.deleteFrom("sessions").where("id", "=", sid).execute()

    // Verify the join is gone
    const joinAfter = await db
      .selectFrom("sessionTags")
      .selectAll()
      .where("sessionId", "=", sid)
      .execute()

    expect(joinAfter).toHaveLength(0)
  })

  it("enforces ON DELETE CASCADE for pause_events and notification_events", async () => {
    // Insert a session
    const { insertId: sessionId } = await db
      .insertInto("sessions")
      .values({
        startedAt: new Date().toISOString(),
        status: "active",
      })
      .executeTakeFirst()

    expect(sessionId).toBeDefined()
    const sid = Number(sessionId)

    // Insert a pause event
    await db
      .insertInto("pauseEvents")
      .values({
        sessionId: sid,
        pausedAt: new Date().toISOString(),
      })
      .execute()

    // Insert a notification event
    await db
      .insertInto("notificationEvents")
      .values({
        sessionId: sid,
        thresholdMinutes: 30,
        thresholdReachedAt: new Date().toISOString(),
      })
      .execute()

    // Verify cascade: delete the session
    await db.deleteFrom("sessions").where("id", "=", sid).execute()

    // Pause events should be gone
    const pauseEvents = await db
      .selectFrom("pauseEvents")
      .selectAll()
      .where("sessionId", "=", sid)
      .execute()

    expect(pauseEvents).toHaveLength(0)

    // Notification events should be gone
    const notifEvents = await db
      .selectFrom("notificationEvents")
      .selectAll()
      .where("sessionId", "=", sid)
      .execute()

    expect(notifEvents).toHaveLength(0)
  })

  it("rejects invalid session status values", async () => {
    // Attempt to insert a session with an invalid status
    const promise = db
      .insertInto("sessions")
      .values({
        startedAt: new Date().toISOString(),
        status: "invalid_status" as any,
      })
      .execute()

    // The CHECK constraint should reject this
    expect(promise).rejects.toThrow(/CHECK|constraint/i)
  })

  it.each(["active", "paused", "completed"] as const)("accepts status '%s'", async (status) => {
    const result = await db
      .insertInto("sessions")
      .values({
        startedAt: new Date().toISOString(),
        status,
      })
      .executeTakeFirst()

    expect(result.insertId).toBeDefined()
    expect(Number(result.insertId)).toBeGreaterThan(0)

    // Clean up active sessions to avoid blocking subsequent tests with the single-active constraint
    if (status === "active") {
      await db
        .updateTable("sessions")
        .set({ status: "completed" })
        .where("id", "=", Number(result.insertId))
        .execute()
    }
  })

  it("has indexes on sessions, session_tags, pause_events, notification_events", async () => {
    const result = await sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name
    `.execute(db)

    const indexNames = result.rows.map((row) => row.name)

    expect(indexNames).toContain("idx_session_tags_session")
    expect(indexNames).toContain("idx_session_tags_tag")
    expect(indexNames).toContain("idx_sessions_project")
    expect(indexNames).toContain("idx_sessions_started")
    expect(indexNames).toContain("idx_sessions_status")
    expect(indexNames).toContain("idx_pause_events_session")
    expect(indexNames).toContain("idx_notification_events_session")
    expect(indexNames).toContain("idx_sessions_single_active")
  })

  it("has triggers on clients and projects", async () => {
    const result = await sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name
    `.execute(db)

    const triggerNames = result.rows.map((row) => row.name)

    expect(triggerNames).toContain("trg_clients_updated_at")
    expect(triggerNames).toContain("trg_projects_updated_at")
  })

  describe("single active session enforcement", () => {
    // Clean slate: remove any leftover sessions from prior tests
    beforeEach(async () => {
      await db.deleteFrom("sessions").execute()
    })

    it("inserts the first active session", async () => {
      const result = await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      expect(result.insertId).toBeDefined()
      expect(Number(result.insertId)).toBeGreaterThan(0)
    })

    it("rejects a second active session", async () => {
      // Insert first active session
      await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      // Second active session should be rejected by the partial unique index
      const promise = db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .execute()

      expect(promise).rejects.toThrow(/UNIQUE|constraint/i)
    })

    it("allows a paused session alongside an active session", async () => {
      // Insert an active session
      await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      // A paused session should be allowed
      const result = await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "paused",
        })
        .executeTakeFirst()

      expect(result.insertId).toBeDefined()
    })

    it("allows a completed session alongside an active session", async () => {
      // Insert an active session
      await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      // A completed session should be allowed
      const result = await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "completed",
        })
        .executeTakeFirst()

      expect(result.insertId).toBeDefined()
    })

    it("allows a new active session after transitioning the old one to paused", async () => {
      // Insert an active session
      await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      // Transition it to paused
      await db
        .updateTable("sessions")
        .set({ status: "paused" })
        .where("status", "=", "active")
        .execute()

      // Now a new active session should succeed
      const result = await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      expect(result.insertId).toBeDefined()
    })

    it("allows updating a non-status column on the active session", async () => {
      // Insert an active session
      const { insertId } = await db
        .insertInto("sessions")
        .values({
          startedAt: new Date().toISOString(),
          status: "active",
        })
        .executeTakeFirst()

      const sid = Number(insertId)

      // Updating the note (non-status column) should succeed
      const updateResult = await db
        .updateTable("sessions")
        .set({ note: "updated note" })
        .where("id", "=", sid)
        .executeTakeFirst()

      expect(updateResult.numUpdatedRows).toBeDefined()
      expect(Number(updateResult.numUpdatedRows)).toBe(1)
    })
  })
})
