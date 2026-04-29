import { CliApp } from "./cli/app";
import { parseCliCommand } from "./cli/lib/args-parser";
import { loadConfig } from "./config/load";
import { Logger } from "./logging/logger";

const main = async (): Promise<void> => {
  try {
    const command = parseCliCommand(Bun.argv.slice(2));

    if (!command) {
      console.error("No command provided. Use --help for usage information.");
      process.exit(1);
    }

    const config = await loadConfig(command.config);
    const logger = new Logger(
      command.logLevel || config.logging.level,
      config.logging.retentionPeriodInDays,
    );
    const app = new CliApp({
      config,
      logger,
    });

    await app.run(command.name);

    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown CLI error.";
    console.error(message);
    process.exit(2);
  }
};

await main();
