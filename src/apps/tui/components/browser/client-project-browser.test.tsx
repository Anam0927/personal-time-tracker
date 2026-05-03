import { afterEach, expect, it } from "bun:test"

import { cleanup, render } from "@/tests/mocks/tty"

import type { BrowserState } from "../../lib/use-browser-state.js"
import { BrowserView } from "./client-project-browser.js"
import type { FlatTreeItem } from "./utils.js"

function createMockClientItem(overrides: Partial<FlatTreeItem> = {}) {
  return {
    id: "client-1",
    type: "client" as const,
    depth: 0,
    label: "Client A",
    clientName: "Client A",
    archived: false,
    isActive: false,
    isExpanded: false,
    clientId: 1,
    ...overrides,
  }
}

function createMockProjectItem(overrides: Partial<FlatTreeItem> = {}) {
  return {
    id: "project-1",
    type: "project" as const,
    depth: 1,
    label: "Project A1",
    clientName: "Client A",
    archived: false,
    isActive: false,
    isExpanded: false,
    clientId: 1,
    projectId: 1,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

const baseState: BrowserState = {
  tree: { clients: [] },
  flatItems: [],
  selectedIndex: 0,
  filterQuery: "",
  includeArchived: false,
  expandedClientIds: new Set(),
  warning: null,
  loading: false,
  error: null,
}

it("renders tree items", async () => {
  const state: BrowserState = {
    ...baseState,
    flatItems: [createMockClientItem({ isExpanded: true }), createMockProjectItem()],
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("▼ Client A")
  expect(frame).toContain("Project A1")
})

it("renders active indicator on active project", async () => {
  const state: BrowserState = {
    ...baseState,
    flatItems: [
      createMockClientItem({ isExpanded: true }),
      createMockProjectItem({ isActive: true }),
    ],
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("●")
})

it("renders loading state", async () => {
  const state: BrowserState = {
    ...baseState,
    loading: true,
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("Loading...")
})

it("renders error state", async () => {
  const state: BrowserState = {
    ...baseState,
    error: "Something went wrong",
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("Error: Something went wrong")
})

it("renders no matches when filtered and empty", async () => {
  const state: BrowserState = {
    ...baseState,
    flatItems: [],
    filterQuery: "zzz",
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  expect(app.lastFrame()).toContain("No matches")
})

it("renders filter query", async () => {
  const state: BrowserState = {
    ...baseState,
    filterQuery: "search",
  }
  const app = render(<BrowserView state={state} />)
  await app.waitUntilRenderFlush()

  const frame = app.lastFrame()
  expect(frame).toContain("search")
})
