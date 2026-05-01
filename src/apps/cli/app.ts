import type { Config } from "@/lib/config/schemas"
import type { Logger } from "@/lib/logging/logger"

import type { CliCommand } from "./lib/parser.types"

export class CliApp {
  private config: Config
  private logger: Logger

  constructor({ config, logger }: { config: Config; logger: Logger }) {
    this.config = config
    this.logger = logger
  }

  async run(command: CliCommand) {
    this.logger.info(`Running command: ${command.name}`)
  }
}
