import type { ReportScope } from "@/features/reporting/schemas"
import type { LogLevel } from "@/lib/logging/schemas"

export type CliCommand =
  | { name: "tui" }
  | { name: "start"; client: string; project: string; tags?: string[] }
  | { name: "stop" }
  | { name: "switch"; client: string; project: string; tags?: string[] }
  | { name: "status" }
  | { name: "report"; reportScope: ReportScope }
  | { name: "update-tags"; tags: string[] }

type CommandWithGlobalOptions<T extends CliCommand> = T & {
  logLevel?: LogLevel
  config?: string
}

export type ParsedCliCommand =
  | { kind: "command"; command: CommandWithGlobalOptions<CliCommand> }
  | { kind: "help" }
  | { kind: "version" }
