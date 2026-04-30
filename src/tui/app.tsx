import { Text, render, useApp, useInput } from "ink"

import { shouldExitNormally } from "./lib/utils"

export function TuiShell() {
  const app = useApp()

  useInput((input, key) => {
    if (!shouldExitNormally(input, key.escape)) {
      return
    }

    app.exit("normal")
  })

  return <Text>Time tracker TUI - Press 'q', 'x', or 'Esc' to exit.</Text>
}

export interface TuiApp {
  run(): Promise<number>
}

export class InkTuiApp implements TuiApp {
  async run(): Promise<number> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return 1
    }

    const app = render(<TuiShell />, { alternateScreen: true })
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
