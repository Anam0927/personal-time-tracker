import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test"

import { addHours } from "date-fns"
import type { Kysely } from "kysely"

import type { DB } from "@/lib/db/types"
import { createTestDb } from "@/tests/test-helper"

import { ClientsRepositoryImpl } from "../clients/repo"
import { ProjectsRepositoryImpl } from "../projects/repo"
import { DashboardService } from "./dashboard.service"
import { SessionsRepositoryImpl } from "./sessions.repo"

let db: Kysely<DB>
let cleanup: () => void

let sessionsRepo: SessionsRepositoryImpl
let clientsRepo: ClientsRepositoryImpl
let projectsRepo: ProjectsRepositoryImpl
let service: DashboardService

beforeAll(async () => {
  const ctx = await createTestDb()
  db = ctx.db
  cleanup = ctx.cleanup

  sessionsRepo = new SessionsRepositoryImpl(db)
  clientsRepo = new ClientsRepositoryImpl(db)
  projectsRepo = new ProjectsRepositoryImpl(db)
  service = new DashboardService(db)
})

afterAll(() => {
  cleanup()
})

beforeEach(async () => {
  await Promise.all([
    db.deleteFrom("sessionTags").execute(),
    db.deleteFrom("pauseEvents").execute(),
    db.deleteFrom("sessions").execute(),
    db.deleteFrom("projects").execute(),
    db.deleteFrom("clients").execute(),
  ])
})

describe("DashboardService", () => {
  describe("getDashboardData()", () => {
    it("returns active session when one is active", async () => {
      const client = await clientsRepo.create("MyClient")
      const project = await projectsRepo.create({ name: "MyProject", clientId: Number(client.id) })

      const session = await sessionsRepo.create({
        startedAt: addHours(new Date(), -1).toISOString(), // 1 hour ago
        status: "active",
        projectId: Number(project.id),
      })

      const data = await service.getDashboardData()

      expect(data.activeSession).not.toBeNull()
      expect(data.activeSession!.id).toBe(session.id)
      expect(data.activeSession!.projectName).toBe("MyProject")
      expect(data.activeSession!.clientName).toBe("MyClient")
      expect(data.activeSession!.elapsedMinutes).toBeGreaterThanOrEqual(55) // ~1 hour = 60 min, allow some tolerance
      expect(data.activeSession!.status).toBe("active")
    })

    it("returns null activeSession when none is active", async () => {
      // Create a completed session (not active)
      const session = await sessionsRepo.create({
        startedAt: addHours(new Date(), -2).toISOString(),
        status: "active",
      })
      await sessionsRepo.transition({
        sessionId: session.id,
        from: "active",
        to: "completed",
      })

      const data = await service.getDashboardData()

      expect(data.activeSession).toBeNull()
    })

    it("computes today's totals correctly", async () => {
      // Create 3 completed sessions — each was active for 1 hour
      for (let i = 0; i < 3; i++) {
        const s = await sessionsRepo.create({
          startedAt: addHours(new Date(), -(i + 1)).toISOString(),
          status: "active",
        })
        await sessionsRepo.transition({
          sessionId: s.id,
          from: "active",
          to: "completed",
        })
      }

      const data = await service.getDashboardData()

      expect(data.todayTotals.sessionCount).toBe(3)
      // Sessions started 1, 2, and 3 hours ago and ended now → ~60 + 120 + 180 = ~360 min
      expect(data.todayTotals.totalElapsedMinutes).toBe(360)
    })

    it("handles empty state gracefully", async () => {
      const data = await service.getDashboardData()

      expect(data.activeSession).toBeNull()
      expect(data.todayTotals.sessionCount).toBe(0)
      expect(data.todayTotals.totalElapsedMinutes).toBe(0)
      expect(data.recentSessions).toEqual([])
    })

    it("returns recent sessions with correct fields", async () => {
      const client = await clientsRepo.create("ClientA")
      const project = await projectsRepo.create({ name: "Alpha", clientId: Number(client.id) })

      const s1 = await sessionsRepo.create({
        startedAt: addHours(new Date(), -2).toISOString(),
        status: "active",
        projectId: Number(project.id),
      })
      await sessionsRepo.transition({
        sessionId: s1.id,
        from: "active",
        to: "completed",
      })

      const s2 = await sessionsRepo.create({
        startedAt: addHours(new Date(), -4).toISOString(),
        status: "active",
      })
      await sessionsRepo.transition({
        sessionId: s2.id,
        from: "active",
        to: "completed",
      })

      const data = await service.getDashboardData()

      expect(data.recentSessions.length).toBeGreaterThanOrEqual(2)

      // Most recent session should have project/client names
      expect(data.recentSessions[0]!.clientName).toBe("ClientA")
      expect(data.recentSessions[0]!.projectName).toBe("Alpha")
      expect(data.recentSessions[0]!.status).toBe("completed")
    })

    it("includes active session in today's totals", async () => {
      // Create completed session first (to avoid single_active_session constraint)
      const s = await sessionsRepo.create({
        startedAt: addHours(new Date(), -2).toISOString(),
        status: "active",
      })
      await sessionsRepo.transition({
        sessionId: s.id,
        from: "active",
        to: "completed",
      })

      // Active session (running now)
      await sessionsRepo.create({
        startedAt: addHours(new Date(), -0.5).toISOString(), // 30 min ago
        status: "active",
      })

      const data = await service.getDashboardData()

      expect(data.todayTotals.sessionCount).toBe(2)
      // Active session contributes elapsed time via getTodaySessions + computeTodayTotals
      // which uses actual pause events and current time for the active (unpaused) session
      expect(data.todayTotals.totalElapsedMinutes).toBeGreaterThanOrEqual(25) // at least 25 min from active
    })
  })
})
