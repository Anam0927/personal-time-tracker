import Fuse from "fuse.js"

import type { ClientProjectTree } from "@/features/clients/browser.service.js"

export interface FlatTreeItem {
  id: string
  type: "client" | "project"
  depth: number
  label: string
  clientName: string
  archived: boolean
  isActive: boolean
  isExpanded: boolean
  clientId: number
  projectId?: number
}

export function flattenTree(
  tree: ClientProjectTree,
  expandedClientIds: Set<number>,
  activeProjectId?: number,
): FlatTreeItem[] {
  const items: FlatTreeItem[] = []

  for (const clientNode of tree.clients) {
    const clientId = clientNode.client.id
    const isExpanded = expandedClientIds.has(clientId)

    items.push({
      id: `client-${clientId}`,
      type: "client",
      depth: 0,
      label: clientNode.client.name,
      clientName: clientNode.client.name,
      archived: clientNode.client.archived ? true : false,
      isActive: false,
      isExpanded,
      clientId,
    })

    if (isExpanded) {
      for (const project of clientNode.projects) {
        items.push({
          id: `project-${project.id}`,
          type: "project",
          depth: 1,
          label: project.name,
          clientName: clientNode.client.name,
          archived: project.archived ? true : false,
          isActive: project.id === activeProjectId,
          isExpanded: false,
          clientId,
          projectId: project.id,
        })
      }
    }
  }

  return items
}

export function applyFilter(
  items: FlatTreeItem[],
  query: string,
  fuse?: Fuse<FlatTreeItem>,
): FlatTreeItem[] {
  if (query === "") {
    return items
  }

  // Use Fuse.js to find matching items
  const f =
    fuse ??
    new Fuse(items, {
      keys: ["label", "clientName"],
      threshold: 0.4,
    })

  const matchedItems = f.search(query)
  const directMatchIds = new Set(matchedItems.map((r) => r.item.id))

  const includedIds = new Set<string>()

  for (const item of items) {
    if (!directMatchIds.has(item.id)) {
      continue
    }

    includedIds.add(item.id)

    if (item.type === "client") {
      // Include all projects under a matching client
      for (const sibling of items) {
        if (sibling.type === "project" && sibling.clientId === item.clientId) {
          includedIds.add(sibling.id)
        }
      }
    }

    if (item.type === "project") {
      // Include parent client for a matching project
      includedIds.add(`client-${item.clientId}`)
    }
  }

  return items.filter((item) => includedIds.has(item.id))
}

export function clampIndex(index: number, max: number): number {
  if (max <= 0) return 0
  if (index < 0) return 0
  if (index >= max) return max - 1
  return index
}
