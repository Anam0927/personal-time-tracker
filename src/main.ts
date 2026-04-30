import { CliApp } from "./cli/app";
import { parseCliCommand } from "./cli/lib/args-parser";
import { loadConfig } from "./config/load";
import { Logger } from "./logging/logger";
import { InkTuiApp } from "./tui/app";

type CommanderBootstrapError = Error & {
  code?: string;
  exitCode?: number;
};

const isCommanderBootstrapError = (
  error: unknown,
): error is CommanderBootstrapError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("commander.")
  );
};

const main = async (): Promise<void> => {
  try {
    const parseResult = parseCliCommand(Bun.argv.slice(2));

    if (!parseResult) {
      console.error(
        'No command provided. Run "bun run cli -- help" to see available commands.',
      );
      process.exit(1);
      return;
    }

    if (parseResult.kind === "help" || parseResult.kind === "version") {
      process.exit(0);
      return;
    }

    const command = parseResult.command;

    if (command.name === "tui") {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error(
          "Interactive TUI requires a TTY session (stdin and stdout must both be terminals).",
        );
        process.exit(1);
        return;
      }

      const tuiApp = new InkTuiApp();
      const exitCode = await tuiApp.run();
      process.exit(exitCode);
      return;
    }

    const config = await loadConfig(command.config, command.logLevel);
    const logger = new Logger(
      config.logging.level,
      config.logging.retentionPeriodInDays,
    );
    const app = new CliApp({
      config,
      logger,
    });

    await app.run(command);

    process.exit(0);
    return;
  } catch (error) {
    if (isCommanderBootstrapError(error)) {
      process.exit(error.exitCode ?? 1);
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unknown CLI error.";
    console.error(message);
    process.exit(2);
    return;
  }
};

await main();
