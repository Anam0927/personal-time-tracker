import { afterEach, beforeEach, expect, it } from "bun:test"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { DashboardData } from "@/features/tracking/dashboard.service"
import type { DashboardService } from "@/features/tracking/dashboard.service"
import { cleanup, render } from "@/tests/mocks/tty"

import { DashboardPanel } from "./dashboard-panel"

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
})

afterEach(() => {
  cleanup()
})

function createMockService(response: DashboardData): DashboardService {
  return {
    getDashboardData: async () => response,
  } as unknown as DashboardService
}

const emptyData: DashboardData = {
  activeSession: null,
  todayTotals: { totalElapsedMinutes: 0, sessionCount: 0 },
  recentSessions: [],
}

function renderWithProvider(element: React.ReactNode) {
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

it("shows loading state initially", () => {
  const service = createMockService(emptyData)
  const app = renderWithProvider(<DashboardPanel dashboardService={service} />)
  expect(app.lastFrame()).toContain("Loading...")
})

// Use a controlled approach: pre-populate the cache instead of waiting for async resolves
it("renders dashboard with data after loading", async () => {
  // Pre-populate the cache so useQuery returns data immediately (no loading state)
  queryClient.setQueryData(["dashboard"], emptyData)

  const service = createMockService(emptyData)
  const app = renderWithProvider(<DashboardPanel dashboardService={service} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("No active timer")
  expect(frame).toContain("No sessions recorded today")
  expect(frame).toContain("No recent sessions")
})

it("shows active timer when present", async () => {
  queryClient.setQueryData(["dashboard"], {
    activeSession: {
      id: 1,
      projectId: 1,
      status: "active" as const,
      startedAt: new Date().toISOString(),
      createdAt: "",
      endedAt: null,
      note: null,
      thresholdMinutes: null,
      projectName: "My Project",
      clientName: "My Client",
      elapsedMinutes: 125,
    },
    todayTotals: { totalElapsedMinutes: 125, sessionCount: 1 },
    recentSessions: [],
  })

  const service = createMockService(emptyData)
  const app = renderWithProvider(<DashboardPanel dashboardService={service} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("My Client / My Project")
  expect(frame).toContain("2h 5m")
})

it("shows recent sessions", async () => {
  queryClient.setQueryData(["dashboard"], {
    activeSession: null,
    todayTotals: { totalElapsedMinutes: 45, sessionCount: 2 },
    recentSessions: [
      {
        id: 1,
        clientName: "C1",
        projectName: "P1",
        elapsedMinutes: 30,
        status: "completed" as const,
        startedAt: "",
        createdAt: "",
        endedAt: null,
        note: null,
        projectId: 10,
        thresholdMinutes: null,
      },
      {
        id: 2,
        clientName: "C2",
        projectName: "P2",
        elapsedMinutes: 15,
        status: "paused" as const,
        startedAt: "",
        createdAt: "",
        endedAt: null,
        note: null,
        projectId: null,
        thresholdMinutes: null,
      },
    ],
  })

  const service = createMockService(emptyData)
  const app = renderWithProvider(<DashboardPanel dashboardService={service} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("C1 / P1")
  expect(frame).toContain("C2 / P2")
  expect(frame).toContain("✓")
  expect(frame).toContain("⏸")
})
