import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

type ParsedCommand = null | {
  name: string;
  config?: string;
  logLevel?: string;
};

const parseCliCommandMock = mock((_argv: string[]): ParsedCommand => null);
const loadConfigMock = mock(async () => ({
  tracking: {
    shortSleepThresholdInMinutes: 5,
    reminders: {
      repeatIntervalInMinutes: 5,
    },
  },
  logging: {
    level: "info" as const,
    retentionPeriodInDays: 7,
  },
}));
const loggerConstructorMock = mock(
  (_level?: string, _retentionPeriodInDays?: number) => undefined,
);
const cliAppConstructorMock = mock((_args: unknown) => undefined);
const appRunMock = mock(async (_name: string) => undefined);

class LoggerMock {
  constructor(level?: string, retentionPeriodInDays?: number) {
    loggerConstructorMock(level, retentionPeriodInDays);
  }
}

class CliAppMock {
  constructor(args: unknown) {
    cliAppConstructorMock(args);
  }

  async run(name: string) {
    return appRunMock(name);
  }
}

const processExitMock = mock((_code?: number) => undefined as never);
const consoleErrorMock = mock((..._args: unknown[]) => undefined);
const originalProcessExit = process.exit;
const originalConsoleError = console.error;

async function runMainModule() {
  await import(`./main.ts?test=${Math.random().toString(36).slice(2)}`);
}

describe("main bootstrap", () => {
  beforeEach(() => {
    mock.restore();
    mock.module("./cli/lib/args-parser", () => ({
      parseCliCommand: parseCliCommandMock,
    }));
    mock.module("./config/load", () => ({
      loadConfig: loadConfigMock,
    }));
    mock.module("./logging/logger", () => ({
      Logger: LoggerMock,
    }));
    mock.module("./cli/app", () => ({
      CliApp: CliAppMock,
    }));

    loadConfigMock.mockResolvedValue({
      tracking: {
        shortSleepThresholdInMinutes: 5,
        reminders: {
          repeatIntervalInMinutes: 5,
        },
      },
      logging: {
        level: "info",
        retentionPeriodInDays: 7,
      },
    });

    process.exit = processExitMock as typeof process.exit;
    console.error = consoleErrorMock as typeof console.error;
  });

  afterAll(() => {
    mock.restore();
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
  });

  it("prints error and exits(1) when no command is provided", async () => {
    parseCliCommandMock.mockReturnValueOnce(null);

    await runMainModule();

    expect(console.error).toHaveBeenNthCalledWith(
      1,
      "No command provided. Use --help for usage information.",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("loads config, creates logger with precedence, and runs app", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      name: "status",
      config: "./my-config.json",
      logLevel: "debug",
    });
    loadConfigMock.mockResolvedValueOnce({
      tracking: {
        shortSleepThresholdInMinutes: 5,
        reminders: {
          repeatIntervalInMinutes: 5,
        },
      },
      logging: {
        level: "info",
        retentionPeriodInDays: 14,
      },
    });

    await runMainModule();

    expect(loadConfigMock).toHaveBeenCalledWith("./my-config.json");
    expect(loggerConstructorMock).toHaveBeenCalledWith("debug", 14);
    expect(cliAppConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.any(LoggerMock),
        config: expect.objectContaining({
          logging: expect.objectContaining({ level: "info" }),
        }),
      }),
    );
    expect(appRunMock).toHaveBeenCalledWith("status");
  });

  it("prints thrown error message and exits(2)", async () => {
    parseCliCommandMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await runMainModule();

    expect(console.error).toHaveBeenCalledWith("boom");
    expect(process.exit).toHaveBeenCalledWith(2);
  });
});
