import { useMutation } from "@tanstack/react-query"
import type { Key } from "ink"
import { render, useApp, useInput } from "ink"
import { Kysely } from "kysely"
import { useMemo, useState } from "react"

import { BrowserService } from "@/features/clients/browser.service"
import type { DashboardData } from "@/features/tracking/dashboard.service"
import { DashboardService } from "@/features/tracking/dashboard.service"
import { TimerServiceImpl } from "@/features/tracking/service"
import type { StartResult, SwitchResult } from "@/features/tracking/service"
import type { DB } from "@/lib/db/types"

import { BrowserView } from "./components/browser/client-project-browser"
import { ConfirmationDialog } from "./components/browser/confirmation-dialog"
import type { FlatTreeItem } from "./components/browser/utils"
import { DashboardPanel } from "./components/dashboard-panel"
import { Shell } from "./components/shell"
import { QueryClientProvider, queryClient } from "./lib/provider"
import { useBrowserState } from "./lib/use-browser-state"
import { getResultMessage, shouldExitNormally } from "./lib/utils"

function TuiShellInner({ db }: { db: Kysely<DB> }) {
  const app = useApp()
  const [currentView, setCurrentView] = useState<"dashboard" | "browser">("dashboard")
  const [confirmItem, setConfirmItem] = useState<FlatTreeItem | null>(null)

  // ── Services ──────────────────────────────────────────────────
  const dashboardService = useMemo(() => new DashboardService(db), [db])
  const timerService = useMemo(() => new TimerServiceImpl(db), [db])
  const browserService = useMemo(() => new BrowserService(db), [db])

  // ── Browser state (navigation, filter, selection) ─────────────
  const activeProjectId =
    queryClient.getQueryData<DashboardData>(["dashboard"])?.activeSession?.projectId ?? undefined

  const browserState = useBrowserState(browserService, {
    onExit: () => setCurrentView("dashboard"),
    onProjectSelected: (item: FlatTreeItem, setWarning: (msg: string | null) => void) => {
      const dashboardData = queryClient.getQueryData<DashboardData>(["dashboard"])

      if (!dashboardData?.activeSession) {
        startMutation.mutate({ clientName: item.clientName, projectName: item.label })
        return
      }

      const active = dashboardData.activeSession
      if (active.projectName === item.label && active.clientName === item.clientName) {
        setWarning("Already tracking this project.")
        return
      }

      setConfirmItem(item)
    },
    activeProjectId,
  })

  const { setWarning } = browserState

  // ── Timer mutations ───────────────────────────────────────────
  const onMutationSuccess = (result: StartResult | SwitchResult) => {
    const msg = getResultMessage(result)
    if (msg) {
      setWarning(msg)
    } else {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["clientProjectTree"] })
      setCurrentView("dashboard")
    }
  }

  const onSettled = () => {
    setConfirmItem(null)
  }

  const startMutation = useMutation({
    mutationFn: ({ clientName, projectName }: { clientName: string; projectName: string }) =>
      timerService.start({ clientName, projectName }),
    onSuccess: onMutationSuccess,
    onSettled,
  })

  const switchMutation = useMutation({
    mutationFn: ({ clientName, projectName }: { clientName: string; projectName: string }) =>
      timerService.switch({ clientName, projectName }),
    onSuccess: onMutationSuccess,
    onSettled,
  })

  const isProcessing = startMutation.isPending || switchMutation.isPending

  // ── Confirmation dialog handlers ──────────────────────────────
  const handleConfirm = () => {
    if (isProcessing || !confirmItem) return
    switchMutation.mutate({ clientName: confirmItem.clientName, projectName: confirmItem.label })
  }

  const handleCancel = () => {
    setConfirmItem(null)
  }

  // ── Keyboard dispatch ─────────────────────────────────────────
  useInput((input, key: Key) => {
    if (isProcessing) return
    if (confirmItem) return

    if (key.tab) {
      setCurrentView((v) => (v === "dashboard" ? "browser" : "dashboard"))
      return
    }

    if (currentView === "browser") {
      browserState.handleKey(input, key)
      return
    }

    if (shouldExitNormally(input, key.escape)) {
      app.exit("normal")
    }
  })

  // ── Render ────────────────────────────────────────────────────
  const footerText =
    currentView === "dashboard"
      ? "Press Tab to browse projects"
      : "↑↓/jk: Navigate | Enter: Select | Tab: Dashboard | Esc: Exit"

  return (
    <Shell footerText={footerText}>
      {currentView === "dashboard" ? (
        <DashboardPanel dashboardService={dashboardService} />
      ) : (
        <BrowserView state={browserState.state} />
      )}
      {confirmItem && (
        <ConfirmationDialog
          message={`Switch to '${confirmItem.label}' under '${confirmItem.clientName}'?`}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          disabled={isProcessing}
        />
      )}
    </Shell>
  )
}

export function TuiShell({ db }: { db: Kysely<DB> }) {
  return (
    <QueryClientProvider>
      <TuiShellInner db={db} />
    </QueryClientProvider>
  )
}

export interface TuiApp {
  run(): Promise<number>
}

export class InkTuiApp implements TuiApp {
  constructor(private readonly db: Kysely<DB>) {}

  async run(): Promise<number> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return 1
    }

    const app = render(<TuiShell db={this.db} />, { alternateScreen: true })
    let observedSigintFallback = false

    const onSigint = () => {
      observedSigintFallback = true
      app.unmount()
    }

    process.on("SIGINT", onSigint)

    try {
      const result = await app.waitUntilExit()
      return result === "normal" && !observedSigintFallback ? 0 : 130
    } finally {
      process.off("SIGINT", onSigint)
    }
  }
}
