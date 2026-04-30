import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { ParsedCliCommand } from "./cli/lib/parser.types";
import type { LogLevel } from "./logging/schemas";

const parseCliCommandMock = mock(
  (_argv: string[]): ParsedCliCommand | null => null,
);
const loadConfigMock = mock(async () => ({
  tracking: {
    shortSleepThresholdInMinutes: 5,
    reminders: {
      repeatIntervalInMinutes: 5,
    },
  },
  logging: {
    level: "info" as LogLevel,
    retentionPeriodInDays: 7,
  },
}));
const loggerConstructorMock = mock(
  (_level?: string, _retentionPeriodInDays?: number) => undefined,
);
const cliAppConstructorMock = mock((_args: unknown) => undefined);
const appRunMock = mock(async (_name: unknown) => undefined);
const tuiRunMock = mock(async () => 0);

class LoggerMock {
  constructor(level?: string, retentionPeriodInDays?: number) {
    loggerConstructorMock(level, retentionPeriodInDays);
  }
}

class CliAppMock {
  constructor(args: unknown) {
    cliAppConstructorMock(args);
  }

  async run(command: unknown) {
    return appRunMock(command);
  }
}

class InkTuiAppMock {
  async run() {
    return tuiRunMock();
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
    mock.clearAllMocks();

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
    mock.module("./tui/app", () => ({
      InkTuiApp: InkTuiAppMock,
      TuiShell: () => "Time tracker TUI - Press 'q', 'x', or 'Esc' to exit.",
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
    mock.restore();
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
  });

  it("exits(1) when parser returns no command", async () => {
    parseCliCommandMock.mockReturnValueOnce(null);

    await runMainModule();

    expect(console.error).toHaveBeenCalledWith(
      'No command provided. Run "bun run cli -- help" to see available commands.',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("keeps help ownership in bootstrap", async () => {
    parseCliCommandMock.mockReturnValueOnce({ kind: "help" });

    await runMainModule();

    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(cliAppConstructorMock).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("keeps version ownership in bootstrap", async () => {
    parseCliCommandMock.mockReturnValueOnce({ kind: "version" });

    await runMainModule();

    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(cliAppConstructorMock).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("loads config, creates logger with precedence, and runs app", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: {
        name: "status",
        config: "./my-config.json",
        logLevel: "debug",
      },
    });

    loadConfigMock.mockResolvedValueOnce({
      tracking: {
        shortSleepThresholdInMinutes: 5,
        reminders: {
          repeatIntervalInMinutes: 5,
        },
      },
      logging: {
        level: "debug",
        retentionPeriodInDays: 14,
      },
    });

    await runMainModule();

    expect(loadConfigMock).toHaveBeenCalledWith("./my-config.json", "debug");
    expect(loggerConstructorMock).toHaveBeenCalledWith("debug", 14);
    expect(cliAppConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.any(LoggerMock),
        config: expect.objectContaining({
          logging: expect.objectContaining({ level: "debug" }),
        }),
      }),
    );
    expect(appRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "status" }),
    );
  });

  it("rejects tui when either stdin/stdout is not a tty before loading config", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: { name: "tui" },
    });

    const originalStdin = process.stdin;
    const originalStdout = process.stdout;
    Object.defineProperty(process, "stdin", {
      value: { ...originalStdin, isTTY: false },
      configurable: true,
    });
    Object.defineProperty(process, "stdout", {
      value: { ...originalStdout, isTTY: true },
      configurable: true,
    });

    try {
      await runMainModule();
    } finally {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      });
      Object.defineProperty(process, "stdout", {
        value: originalStdout,
        configurable: true,
      });
    }

    expect(console.error).toHaveBeenCalledWith(
      "Interactive TUI requires a TTY session (stdin and stdout must both be terminals).",
    );
    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(cliAppConstructorMock).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("runs tui before config loading and lets bootstrap own process exit", async () => {
    parseCliCommandMock.mockReturnValueOnce({
      kind: "command",
      command: { name: "tui" },
    });

    const originalStdin = process.stdin;
    const originalStdout = process.stdout;
    Object.defineProperty(process, "stdin", {
      value: { ...originalStdin, isTTY: true },
      configurable: true,
    });
    Object.defineProperty(process, "stdout", {
      value: { ...originalStdout, isTTY: true },
      configurable: true,
    });

    try {
      tuiRunMock.mockResolvedValueOnce(130);
      await runMainModule();
    } finally {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      });
      Object.defineProperty(process, "stdout", {
        value: originalStdout,
        configurable: true,
      });
    }

    expect(tuiRunMock).toHaveBeenCalledTimes(1);
    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(cliAppConstructorMock).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(130);
  });

  it("keeps invalid/unknown commander failures bootstrap-owned", async () => {
    parseCliCommandMock.mockImplementationOnce(() => {
      throw Object.assign(new Error("commander failure"), {
        code: "commander.unknownOption",
        exitCode: 1,
      });
    });

    await runMainModule();

    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(cliAppConstructorMock).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
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
