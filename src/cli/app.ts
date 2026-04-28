import { cliHelpText, parseCliCommand } from "./commands";
import { TuiAppStub } from "../tui/app";
import type { TuiApp } from "../tui/app";

/**
 * CLI application boundary.
 * TODO(AA-379): Wire command handlers to timer, reporting, and persistence services.
 */
export class CliApp {
  constructor(private readonly tuiApp: TuiApp = new TuiAppStub()) {}

  async run(argv: string[]): Promise<number> {
    try {
      const command = parseCliCommand(argv);

      if (command.name === "unknown") {
        console.error(`Unknown command: '${command.rawName}'.`);
        console.error("Run 'help' to see available commands.");
        return 2;
      }

      if (command.name === "help") {
        console.log(cliHelpText());
        return 0;
      }

      if (command.name === "tui") {
        await this.tuiApp.run();
        return 1;
      }

      console.log(`Command '${command.name}' is not implemented yet.`);

      if (command.name === "report") {
        console.log(`Requested report scope: ${command.reportScope}`);
      }

      return 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CLI error.";
      console.error(message);
      return 2;
    }
  }
}
