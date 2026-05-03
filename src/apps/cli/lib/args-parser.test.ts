import { describe, expect, it, mock, beforeAll } from "bun:test"

import type { ParsedCliCommand } from "./parser.types"

type ParseCliCommand = (argv: string[]) => ParsedCliCommand | null
let parseCliCommand: ParseCliCommand

beforeAll(async () => {
  // Clear any module mocks that may have been installed by other test files
  mock.clearAllMocks()
  const mod = await import("./args-parser")
  parseCliCommand = mod.parseCliCommand
})

describe("parseCliCommand", () => {
  describe("meta commands", () => {
    it("returns help for --help", () => {
      expect(parseCliCommand(["--help"])).toEqual({ kind: "help" })
    })

    it("returns version for --version", () => {
      expect(parseCliCommand(["--version"])).toEqual({ kind: "version" })
    })

    it("returns null for unknown command", () => {
      expect(parseCliCommand(["unknown"])).toBeNull()
    })

    it("returns help for empty argv", () => {
      expect(parseCliCommand([])).toEqual({ kind: "help" })
    })
  })

  describe("start command", () => {
    it("parses start with client and project", () => {
      expect(parseCliCommand(["start", "-c", "MyClient", "-p", "MyProject"])).toEqual({
        kind: "command",
        command: { name: "start", client: "myclient", project: "myproject" },
      })
    })

    it("throws when start is missing -c", () => {
      expect(() => parseCliCommand(["start", "-p", "MyProject"])).toThrow()
    })

    it("throws when start has no options", () => {
      expect(() => parseCliCommand(["start"])).toThrow()
    })

    it("throws when start is missing -p", () => {
      expect(() => parseCliCommand(["start", "-c", "MyClient"])).toThrow()
    })

    it("parses start with tags", () => {
      expect(
        parseCliCommand([
          "start",
          "-c",
          "MyClient",
          "-p",
          "MyProject",
          "-t",
          "urgent",
          "-t",
          "billing",
        ]),
      ).toEqual({
        kind: "command",
        command: {
          name: "start",
          client: "myclient",
          project: "myproject",
          tags: ["urgent", "billing"],
        },
      })
    })
  })

  describe("stop command", () => {
    it("parses stop", () => {
      expect(parseCliCommand(["stop"])).toEqual({
        kind: "command",
        command: { name: "stop" },
      })
    })
  })

  describe("switch command", () => {
    it("parses switch with client and project", () => {
      expect(parseCliCommand(["switch", "-c", "MyClient", "-p", "MyProject"])).toEqual({
        kind: "command",
        command: { name: "switch", client: "myclient", project: "myproject" },
      })
    })

    it("throws when switch is missing -c", () => {
      expect(() => parseCliCommand(["switch", "-p", "MyProject"])).toThrow()
    })

    it("throws when switch is missing -p", () => {
      expect(() => parseCliCommand(["switch", "-c", "MyClient"])).toThrow()
    })

    it("parses switch with tags", () => {
      expect(
        parseCliCommand(["switch", "-c", "MyClient", "-p", "MyProject", "-t", "bugfix"]),
      ).toEqual({
        kind: "command",
        command: { name: "switch", client: "myclient", project: "myproject", tags: ["bugfix"] },
      })
    })
  })

  describe("status command", () => {
    it("parses status", () => {
      expect(parseCliCommand(["status"])).toEqual({
        kind: "command",
        command: { name: "status" },
      })
    })
  })

  describe("report command", () => {
    it("parses report with default scope", () => {
      expect(parseCliCommand(["report"])).toEqual({
        kind: "command",
        command: { name: "report", reportScope: "today" },
      })
    })

    it("parses report with explicit scope", () => {
      expect(parseCliCommand(["report", "-s", "week"])).toEqual({
        kind: "command",
        command: { name: "report", reportScope: "week" },
      })
    })

    it("parses report with client scope", () => {
      expect(parseCliCommand(["report", "-s", "client"])).toEqual({
        kind: "command",
        command: { name: "report", reportScope: "client" },
      })
    })
  })

  describe("tui command", () => {
    it("parses tui", () => {
      expect(parseCliCommand(["tui"])).toEqual({
        kind: "command",
        command: { name: "tui" },
      })
    })
  })

  describe("update-tags command", () => {
    it("parses update-tags with tags", () => {
      expect(parseCliCommand(["update-tags", "-t", "urgent", "-t", "billing"])).toEqual({
        kind: "command",
        command: { name: "update-tags", tags: ["urgent", "billing"] },
      })
    })

    it("throws when update-tags has no tags", () => {
      expect(() => parseCliCommand(["update-tags"])).toThrow()
    })
  })

  describe("global options", () => {
    it.each([
      { label: "start", args: ["start", "-c", "myclient", "-p", "myproject"] },
      { label: "stop", args: ["stop"] },
      { label: "switch", args: ["switch", "-c", "myclient", "-p", "myproject"] },
      { label: "status", args: ["status"] },
      { label: "report", args: ["report"] },
      { label: "tui", args: ["tui"] },
    ])("propagates --config to $label", ({ args }) => {
      expect(parseCliCommand([...args, "--config", "./my-config.json"])).toEqual({
        kind: "command",
        command: expect.objectContaining({ config: "./my-config.json" }),
      })
    })

    it.each([
      { label: "start", args: ["start", "-c", "myclient", "-p", "myproject"] },
      { label: "stop", args: ["stop"] },
      { label: "switch", args: ["switch", "-c", "myclient", "-p", "myproject"] },
      { label: "status", args: ["status"] },
      { label: "report", args: ["report"] },
      { label: "tui", args: ["tui"] },
    ])("propagates --log-level to $label", ({ args }) => {
      expect(parseCliCommand([...args, "--log-level", "debug"])).toEqual({
        kind: "command",
        command: expect.objectContaining({ logLevel: "debug" }),
      })
    })
  })

  describe("invalid input", () => {
    it("throws for invalid --log-level value", () => {
      expect(() => parseCliCommand(["status", "--log-level", "invalid"])).toThrow()
    })

    it("throws for invalid report scope", () => {
      expect(() => parseCliCommand(["report", "-s", "invalid"])).toThrow()
    })
  })
})
