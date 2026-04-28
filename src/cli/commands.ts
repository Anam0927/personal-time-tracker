import type { ReportScope } from "../types";

export type CliCommandName =
  | "help"
  | "tui"
  | "start"
  | "stop"
  | "switch"
  | "status"
  | "report"
  | "unknown";

export type CliCommand =
  | { name: "help"; args: string[] }
  | { name: "tui"; args: string[] }
  | { name: "start"; args: string[] }
  | { name: "stop"; args: string[] }
  | { name: "switch"; args: string[] }
  | { name: "status"; args: string[] }
  | { name: "report"; reportScope: ReportScope; args: string[] }
  | { name: "unknown"; rawName: string; args: string[] };

/**
 * Parse CLI args into a command shape.
 * TODO(AA-379): Replace with a robust parser and typed options.
 */
export const parseCliCommand = (argv: string[]): CliCommand => {
  const [rawName, ...remainingArgs] = argv;

  if (!rawName || rawName === "help" || rawName === "--help" || rawName === "-h") {
    return { name: "help", args: remainingArgs };
  }

  if (rawName === "tui") {
    return { name: "tui", args: remainingArgs };
  }

  if (rawName === "report") {
    const reportScope = parseReportScope(remainingArgs[0]);
    return { name: "report", reportScope, args: remainingArgs.slice(1) };
  }

  if (rawName === "start" || rawName === "stop" || rawName === "switch" || rawName === "status") {
    return { name: rawName, args: remainingArgs };
  }

  return { name: "unknown", rawName, args: remainingArgs };
};

const parseReportScope = (rawScope: string | undefined): ReportScope => {
  if (!rawScope) {
    return "today";
  }

  if (rawScope === "today" || rawScope === "week" || rawScope === "client" || rawScope === "project") {
    return rawScope;
  }

  throw new Error(
    `Invalid report scope: ${rawScope}. Expected one of: today, week, client, project.`,
  );
};

export const cliHelpText = (): string => {
  return [
    "track (scaffold)",
    "",
    "Usage:",
    "  bun run cli -- <command>",
    "",
    "Commands:",
    "  help                Show this help output",
    "  tui                 Launch TUI placeholder",
    "  start               Start timer (placeholder)",
    "  stop                Stop timer (placeholder)",
    "  switch              Switch timer (placeholder)",
    "  status              Show status (placeholder)",
    "  report [scope]      Report placeholder (scope: today|week|client|project)",
  ].join("\n");
};
