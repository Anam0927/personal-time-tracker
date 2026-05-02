import type { ReportScope } from "@/features/reporting/schemas"
import type { LogLevel } from "@/lib/logging/schemas"

import { createCommandProgram } from "../commands"
import type { ParsedCliCommand } from "./parser.types"

/**
 * Parse CLI args into a command shape.
 */
export const parseCliCommand = (argv: string[]): ParsedCliCommand | null => {
  const userArgv = [...argv]
  const commandProgram = createCommandProgram()

  // prevent commander from exiting the process automatically on error
  commandProgram.exitOverride()

  for (const cmd of commandProgram.commands) {
    cmd.exitOverride()
  }

  try {
    commandProgram.parse(userArgv, { from: "user" })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "commander.help" || error.code === "commander.helpDisplayed") {
        return { kind: "help" }
      }

      if (error.code === "commander.version") {
        return { kind: "version" }
      }

      if (error.code === "commander.unknownCommand") {
        return null
      }
    }

    throw error
  }

  const command = commandProgram.commands.find((cmd) => cmd.name() === userArgv[0])

  if (!command) {
    return null
  }

  const defaultOptions = commandProgram.opts() as {
    logLevel?: LogLevel
    config?: string
  }

  if (command.name() === "start") {
    const startOptions = command.opts() as {
      client: string
      project: string
      tag?: string[]
    }

    if (Object.keys(startOptions).length > 0) {
      return {
        kind: "command",
        command: {
          name: "start",
          client: startOptions.client,
          project: startOptions.project,
          ...(startOptions.tag && startOptions.tag.length > 0 ? { tags: startOptions.tag } : {}),
          ...defaultOptions,
        },
      }
    }
  }

  if (command.name() === "stop") {
    return {
      kind: "command",
      command: { name: "stop", ...defaultOptions },
    }
  }

  if (command.name() === "switch") {
    const switchOptions = command.opts() as {
      client: string
      project: string
      tag?: string[]
    }

    if (Object.keys(switchOptions).length > 0) {
      return {
        kind: "command",
        command: {
          name: "switch",
          client: switchOptions.client,
          project: switchOptions.project,
          ...(switchOptions.tag && switchOptions.tag.length > 0 ? { tags: switchOptions.tag } : {}),
          ...defaultOptions,
        },
      }
    }
  }

  if (command.name() === "update-tags") {
    const updateOptions = command.opts() as {
      tag: string[]
    }

    return {
      kind: "command",
      command: {
        name: "update-tags",
        tags: updateOptions.tag,
        ...defaultOptions,
      },
    }
  }

  if (command.name() === "status") {
    return {
      kind: "command",
      command: { name: "status", ...defaultOptions },
    }
  }

  if (command.name() === "report") {
    const reportOptions = command.opts() as {
      scope: ReportScope
    }

    return {
      kind: "command",
      command: {
        name: "report",
        reportScope: reportOptions.scope,
        ...defaultOptions,
      },
    }
  }

  if (command.name() === "tui") {
    return {
      kind: "command",
      command: { name: "tui", ...defaultOptions },
    }
  }

  return null
}
