import { describe, expect, it } from "bun:test"

import type { ClientProjectTree } from "@/features/clients/browser.service.js"

import { applyFilter, clampIndex, flattenTree } from "./utils.js"

const mockTree: ClientProjectTree = {
  clients: [
    {
      client: { id: 1, name: "Client A", archived: 0, createdAt: "", updatedAt: "" },
      projects: [
        {
          id: 1,
          clientId: 1,
          name: "Project A1",
          archived: 0,
          color: null,
          description: null,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: 2,
          clientId: 1,
          name: "Project A2",
          archived: 0,
          color: null,
          description: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    },
    {
      client: { id: 2, name: "Client B", archived: 0, createdAt: "", updatedAt: "" },
      projects: [
        {
          id: 3,
          clientId: 2,
          name: "Project B1",
          archived: 0,
          color: null,
          description: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    },
  ],
}

describe("flattenTree", () => {
  it("flattenTree with empty tree returns []", () => {
    const items = flattenTree({ clients: [] }, new Set())
    expect(items).toEqual([])
  })

  it("flattenTree with 2 clients, none expanded, returns client rows only", () => {
    const items = flattenTree(mockTree, new Set())
    expect(items).toHaveLength(2)
    expect(items[0]?.type).toBe("client")
    expect(items[0]?.label).toBe("Client A")
    expect(items[1]?.type).toBe("client")
    expect(items[1]?.label).toBe("Client B")
  })

  it("flattenTree with 2 clients, both expanded, returns clients interleaved with their projects", () => {
    const items = flattenTree(mockTree, new Set([1, 2]))
    expect(items).toHaveLength(5)
    expect(items[0]?.label).toBe("Client A")
    expect(items[1]?.label).toBe("Project A1")
    expect(items[2]?.label).toBe("Project A2")
    expect(items[3]?.label).toBe("Client B")
    expect(items[4]?.label).toBe("Project B1")
  })

  it("flattenTree with active project sets isActive on that project", () => {
    const items = flattenTree(mockTree, new Set([1, 2]), 2)
    const projectA2 = items.find((i) => i.id === "project-2")
    expect(projectA2?.isActive).toBe(true)
    const projectA1 = items.find((i) => i.id === "project-1")
    expect(projectA1?.isActive).toBe(false)
  })

  it("flattenTree with partial expansion returns correct mix", () => {
    const items = flattenTree(mockTree, new Set([1]))
    expect(items).toHaveLength(4)
    expect(items[0]?.type).toBe("client")
    expect(items[0]?.label).toBe("Client A")
    expect(items[1]?.type).toBe("project")
    expect(items[1]?.label).toBe("Project A1")
    expect(items[2]?.type).toBe("project")
    expect(items[2]?.label).toBe("Project A2")
    expect(items[3]?.type).toBe("client")
    expect(items[3]?.label).toBe("Client B")
  })
})

describe("applyFilter", () => {
  const items = flattenTree(mockTree, new Set([1, 2]))

  it("applyFilter with empty query returns all items", () => {
    expect(applyFilter(items, "")).toEqual(items)
  })

  it("applyFilter matching project name returns matching items", () => {
    const result = applyFilter(items, "Project A1")
    // Fuse.js at 0.4 also matches similar project names (A2, B1),
    // which brings in their parent clients
    expect(result).toHaveLength(5)
    expect(result[0]?.type).toBe("client")
    expect(result[0]?.clientName).toBe("Client A")
    expect(result[1]?.type).toBe("project")
    expect(result[1]?.label).toBe("Project A1")
  })

  it("applyFilter matching client name returns client and all related matches", () => {
    const result = applyFilter(items, "Client A")
    // Fuse.js at 0.4 matches "Client A" which is similar to "Client B"
    expect(result).toHaveLength(5)
    expect(result[0]?.type).toBe("client")
    expect(result[0]?.label).toBe("Client A")
    expect(result[1]?.type).toBe("project")
    expect(result[1]?.label).toBe("Project A1")
  })

  it("applyFilter with unique project suffix returns targeted results", () => {
    const result = applyFilter(items, "B1")
    expect(result).toHaveLength(2)
    expect(result[0]?.type).toBe("client")
    expect(result[0]?.clientName).toBe("Client B")
    expect(result[1]?.type).toBe("project")
    expect(result[1]?.label).toBe("Project B1")
  })
})

describe("clampIndex", () => {
  it("clampIndex basic (0, 5) returns 0", () => {
    expect(clampIndex(0, 5)).toBe(0)
  })

  it("clampIndex within range (3, 5) returns 3", () => {
    expect(clampIndex(3, 5)).toBe(3)
  })

  it("clampIndex too high (7, 5) returns 4", () => {
    expect(clampIndex(7, 5)).toBe(4)
  })

  it("clampIndex negative (-1, 5) returns 0", () => {
    expect(clampIndex(-1, 5)).toBe(0)
  })

  it("clampIndex max=0 returns 0", () => {
    expect(clampIndex(0, 0)).toBe(0)
    expect(clampIndex(5, 0)).toBe(0)
    expect(clampIndex(-1, 0)).toBe(0)
  })
})
