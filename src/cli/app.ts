import type { Config } from "@/config/schemas";
import type { Logger } from "@/logging/logger";

export class CliApp {
  private config: Config;
  private logger: Logger;

  constructor({ config, logger }: { config: Config; logger: Logger }) {
    this.config = config;
    this.logger = logger;
  }

  async run(name: string) {
    this.logger.info(`Running command: ${name}`);
  }
}
