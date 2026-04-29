import type { LogLevel } from "@/logging/schemas";
import type { ReportScope } from "@/reporting/schemas";
import { commandProgram } from "../commands";

export type CliCommand =
  | { name: "tui" }
  | { name: "start"; client: string; project: string }
  | { name: "stop" }
  | { name: "switch"; client: string; project: string }
  | { name: "status" }
  | { name: "report"; reportScope: ReportScope };

/**
 * Parse CLI args into a command shape.
 */
export const parseCliCommand = (
  argv: string[],
): (CliCommand & { logLevel?: LogLevel; config?: string }) | null => {
  commandProgram.parse(argv, { from: "user" });

  const command = commandProgram.commands.find((cmd) => cmd.name() === argv[0]);

  if (!command) {
    return null;
  }

  const defaultOptions = commandProgram.opts() as {
    logLevel?: LogLevel;
    config?: string;
  };

  if (command.name() === "start") {
    const startOptions = command.opts() as {
      client: string;
      project: string;
    };

    if (Object.keys(startOptions).length > 0) {
      return { name: "start", ...startOptions, ...defaultOptions };
    }
  }

  if (command.name() === "stop") {
    return { name: "stop", ...defaultOptions };
  }

  if (command.name() === "switch") {
    const switchOptions = command.opts() as {
      client: string;
      project: string;
    };

    if (Object.keys(switchOptions).length > 0) {
      return { name: "switch", ...switchOptions, ...defaultOptions };
    }
  }

  if (command.name() === "status") {
    return { name: "status", ...defaultOptions };
  }

  if (command.name() === "report") {
    const reportOptions = command.opts() as {
      scope: ReportScope;
    };

    return {
      name: "report",
      reportScope: reportOptions.scope,
      ...defaultOptions,
    };
  }

  if (command.name() === "tui") {
    return { name: "tui", ...defaultOptions };
  }

  return null;
};
