import { useQuery } from "@tanstack/react-query"
import { Box, Text } from "ink"

import type { DashboardData, DashboardService } from "@/features/tracking/dashboard.service"

interface DashboardPanelProps {
  dashboardService: DashboardService
}

export function DashboardPanel({ dashboardService }: DashboardPanelProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.getDashboardData(),
    refetchInterval: 1000,
  })

  if (isLoading) {
    return <Text>Loading...</Text>
  }

  if (isError) {
    return <Text color="red">Unable to load dashboard: {error.message}</Text>
  }

  return <DashboardView data={data!} />
}

function DashboardView({ data }: { data: DashboardData }) {
  return (
    <Box flexDirection="column" gap={1}>
      <ActiveTimerSection activeSession={data.activeSession} />
      <TodayTotalsSection totals={data.todayTotals} />
      <RecentSessionsSection sessions={data.recentSessions} />
    </Box>
  )
}

function ActiveTimerSection({ activeSession }: { activeSession: DashboardData["activeSession"] }) {
  if (!activeSession) {
    return (
      <Box>
        <Text bold>Active Timer: </Text>
        <Text dimColor>No active timer</Text>
      </Box>
    )
  }

  const name = [activeSession.clientName, activeSession.projectName].filter(Boolean).join(" / ")

  return (
    <Box>
      <Text bold>Active Timer: </Text>
      <Text>
        {name ? `${name} — ` : ""}
        {formatElapsed(activeSession.elapsedMinutes)}
      </Text>
    </Box>
  )
}

function TodayTotalsSection({ totals }: { totals: DashboardData["todayTotals"] }) {
  if (totals.sessionCount === 0) {
    return (
      <Box>
        <Text bold>Today: </Text>
        <Text dimColor>No sessions recorded today</Text>
      </Box>
    )
  }

  const label = totals.sessionCount === 1 ? "session" : "sessions"
  return (
    <Box>
      <Text bold>Today: </Text>
      <Text>
        {formatElapsed(totals.totalElapsedMinutes)} across {totals.sessionCount} {label}
      </Text>
    </Box>
  )
}

function RecentSessionsSection({ sessions }: { sessions: DashboardData["recentSessions"] }) {
  if (sessions.length === 0) {
    return (
      <Box>
        <Text bold>Recent: </Text>
        <Text dimColor>No recent sessions</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Recent Sessions:</Text>
      {sessions.map((s) => {
        const name = [s.clientName, s.projectName].filter(Boolean).join(" / ")
        const icon = s.status === "active" ? "▶" : s.status === "paused" ? "⏸" : "✓"
        return (
          <Box key={s.id} marginLeft={2}>
            <Text>
              {icon} {name || "(no project)"} — {formatElapsed(s.elapsedMinutes)}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

function formatElapsed(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m"
  const h = Math.floor(totalMinutes / 60)
  const m = Math.floor(totalMinutes % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}
