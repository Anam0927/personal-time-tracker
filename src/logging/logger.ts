import path from "node:path"

import { pino, transport, type TransportMultiOptions } from "pino"
import { xdgState } from "xdg-basedir"

import type { LogLevel } from "./schemas"

export class Logger {
  private logger: ReturnType<typeof pino>

  constructor(logLevel: LogLevel = "info", retentionPeriodInDays: number = 7) {
    const isDevelopment = process.env.NODE_ENV !== "production"

    let targets: TransportMultiOptions["targets"] = []

    if (!isDevelopment) {
      if (!xdgState) {
        throw new Error("XDG_STATE_HOME is not set. Cannot determine log directory.")
      }

      targets = [
        {
          target: "pino-roll",
          options: {
            file: path.resolve(path.join(xdgState, "time-tracker", "logs", "app")),
            mkdir: true,
            frequency: "daily",
            dateFormat: "yyyy-MM-dd",
            limit: {
              count: retentionPeriodInDays,
            },
          },
        },
      ]
    }

    targets = [...targets, { target: "pino-pretty" }]

    this.logger = pino(
      {
        level: logLevel,
      },
      transport({
        targets,
      }),
    )
  }

  info(message: string, details?: Record<string, unknown>) {
    if (!details) {
      this.logger.info(message)
    } else {
      this.logger.info(details, message)
    }
  }

  error(message: string, details?: Record<string, unknown>) {
    if (!details) {
      this.logger.error(message)
    } else {
      this.logger.error(details, message)
    }
  }

  debug(message: string, details?: Record<string, unknown>) {
    if (!details) {
      this.logger.debug(message)
    } else {
      this.logger.debug(details, message)
    }
  }

  warn(message: string, details?: Record<string, unknown>) {
    if (!details) {
      this.logger.warn(message)
    } else {
      this.logger.warn(details, message)
    }
  }
}
