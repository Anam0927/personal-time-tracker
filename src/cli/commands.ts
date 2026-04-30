import { Command, InvalidOptionArgumentError, Option } from "commander"
import z from "zod"

import { logLevel } from "@/logging/schemas"

import { reportScope } from "../reporting/schemas"

function toLowerString(value: string) {
  const parseResult = z.string().trim().nonempty().toLowerCase().safeParse(value)

  if (parseResult.error) {
    throw new InvalidOptionArgumentError(
      z.treeifyError(parseResult.error).errors?.[0] || "Invalid string argument",
    )
  }

  return parseResult.data
}

export const createCommandProgram = (): Command => {
  const commandProgram = new Command()

  commandProgram
    .name("time-tracker")
    .alias("tt")
    .description("A simple time tracking CLI tool.")
    .version("0.1.0")

  commandProgram.addOption(
    new Option("--log-level <level>", "Set the log level").choices(logLevel.options),
  )

  commandProgram.option("--config <path>", "Path to config file relative to project root")

  commandProgram
    .command("start")
    .description("Start a new timer for a client and project.")
    .requiredOption("-c, --client <client>", "Client name", toLowerString)
    .requiredOption("-p, --project <project>", "Project name", toLowerString)

  commandProgram.command("stop").description("Stop the active timer.")

  commandProgram
    .command("switch")
    .description("Switch to a different client and project.")
    .requiredOption("-c, --client <client>", "Client name", toLowerString)
    .requiredOption("-p, --project <project>", "Project name", toLowerString)

  commandProgram.command("status").description("Show the status of the active timer.")

  commandProgram
    .command("report")
    .description("Generate a report for a given scope (today, week, client, project).")
    .addOption(
      new Option("-s, --scope <scope>", "Report scope")
        .choices(reportScope.options)
        .default("today"),
    )

  commandProgram.command("tui").description("Launch the interactive TUI.")

  return commandProgram
}
