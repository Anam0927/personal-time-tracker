import type { LogLevel } from "@/logging/schemas"
import type { ReportScope } from "@/reporting/schemas"

export type CliCommand =
  | { name: "tui" }
  | { name: "start"; client: string; project: string }
  | { name: "stop" }
  | { name: "switch"; client: string; project: string }
  | { name: "status" }
  | { name: "report"; reportScope: ReportScope }

type CommandWithGlobalOptions<T extends CliCommand> = T & {
  logLevel?: LogLevel
  config?: string
}

export type ParsedCliCommand =
  | { kind: "command"; command: CommandWithGlobalOptions<CliCommand> }
  | { kind: "help" }
  | { kind: "version" }
