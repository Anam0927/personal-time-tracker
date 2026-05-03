import { render, useApp, useInput } from "ink"
import { useMemo } from "react"
import type { Kysely } from "kysely"

import { DashboardService } from "@/features/tracking/dashboard.service"
import type { DB } from "@/lib/db/types"

import { DashboardPanel } from "./components/dashboard-panel"
import { Shell } from "./components/shell"
import { shouldExitNormally } from "./lib/utils"
import { QueryClientProvider } from "./lib/provider"

export function TuiShell({ db }: { db: Kysely<DB> }) {
  const app = useApp()
  const dashboardService = useMemo(() => new DashboardService(db), [db])

  useInput((input, key) => {
    if (!shouldExitNormally(input, key.escape)) {
      return
    }

    app.exit("normal")
  })

  return (
    <QueryClientProvider>
      <Shell>
        <DashboardPanel dashboardService={dashboardService} />
      </Shell>
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
