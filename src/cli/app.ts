import type { Config } from "@/config/schemas";
import type { CliCommand } from "@/cli/lib/parser.types";
import type { Logger } from "@/logging/logger";

export class CliApp {
  private config: Config;
  private logger: Logger;

  constructor({ config, logger }: { config: Config; logger: Logger }) {
    this.config = config;
    this.logger = logger;
  }

  async run(command: CliCommand) {
    this.logger.info(`Running command: ${command.name}`);
  }
}
