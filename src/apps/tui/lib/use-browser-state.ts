import { useQuery } from "@tanstack/react-query"
import Fuse from "fuse.js"
import type { Key } from "ink"
import { useCallback, useMemo, useState } from "react"

import type { BrowserService, ClientProjectTree } from "@/features/clients/browser.service.js"

import {
  applyFilter,
  clampIndex,
  flattenTree,
  type FlatTreeItem,
} from "../components/browser/utils"

export interface BrowserState {
  tree: ClientProjectTree
  flatItems: FlatTreeItem[]
  selectedIndex: number
  filterQuery: string
  includeArchived: boolean
  expandedClientIds: Set<number>
  warning: string | null
  loading: boolean
  error: string | null
}

export function useBrowserState(
  browserService: BrowserService,
  options?: {
    activeProjectId?: number
    onProjectSelected?: (item: FlatTreeItem, setWarning: (msg: string | null) => void) => void
    onExit?: () => void
  },
): {
  state: BrowserState
  handleKey: (input: string, key: Key) => void
  setWarning: (msg: string | null) => void
} {
  const [expandedClientIds, setExpandedClientIds] = useState<Set<number>>(new Set())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filterQuery, setFilterQuery] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["clientProjectTree", includeArchived],
    queryFn: () => browserService.getTree({ includeArchived }),
    refetchInterval: 5000,
  })

  const tree = data ?? { clients: [] }

  // 1. Tree items — only recomputes on tree structure changes (expand/collapse, data refresh)
  const treeItems = useMemo(
    () => flattenTree(tree, expandedClientIds, options?.activeProjectId),
    [tree, expandedClientIds, options?.activeProjectId],
  )

  // 2. Fuse instance — only recomputes when tree items change
  const treeFuse = useMemo(
    () =>
      new Fuse(treeItems, {
        keys: ["label", "clientName"],
        threshold: 0.4,
        includeScore: false,
      }),
    [treeItems],
  )

  // 3. Flat items — uses cached Fuse for filtering on keystrokes
  const flatItems = useMemo(
    () => applyFilter(treeItems, filterQuery, treeFuse),
    [treeItems, treeFuse, filterQuery],
  )

  // Clamp selected index when item count changes
  const clampedIndex = useMemo(
    () => clampIndex(selectedIndex, flatItems.length),
    [selectedIndex, flatItems.length],
  )

  const handleKey = useCallback(
    (input: string, key: Key) => {
      // Navigation
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) => clampIndex(prev - 1, flatItems.length))
        return
      }
      if (key.downArrow || input === "j") {
        setSelectedIndex((prev) => clampIndex(prev + 1, flatItems.length))
        return
      }
      if (key.pageUp || key.pageDown) {
        const pageSize = 10
        const delta = key.pageUp ? -pageSize : pageSize
        setSelectedIndex((prev) => clampIndex(prev + delta, flatItems.length))
        return
      }

      // Expand / Collapse client or Select project
      if (key.return || input === " ") {
        const item = flatItems[selectedIndex]
        if (!item) {
          return
        }
        if (item.type === "client") {
          setExpandedClientIds((prev) => {
            const next = new Set(prev)
            if (next.has(item.clientId)) {
              next.delete(item.clientId)
            } else {
              next.add(item.clientId)
            }
            return next
          })
          return
        }
        // Project selected
        if (item.type === "project") {
          options?.onProjectSelected?.(item, setWarning)
          return
        }
        return
      }

      // Backspace / Delete — remove last filter char
      if (key.backspace || key.delete) {
        setFilterQuery((prev) => {
          if (prev.length === 0) {
            return prev
          }
          return prev.slice(0, -1)
        })
        setSelectedIndex(0)
        return
      }

      // Escape — clear filter or exit
      if (key.escape) {
        if (filterQuery) {
          setFilterQuery("")
          setSelectedIndex(0)
          return
        }
        options?.onExit?.()
        return
      }

      // Ctrl+A — toggle archive filter
      if (key.ctrl && input === "a") {
        setIncludeArchived((prev) => !prev)
        setSelectedIndex(0)
        return
      }

      // Typed key — add to filter
      if (input.length === 1 && input >= " " && input <= "~") {
        setFilterQuery((prev) => prev + input)
        setSelectedIndex(0)
        return
      }
    },
    [flatItems, selectedIndex, filterQuery, options],
  )

  const state: BrowserState = {
    tree,
    flatItems,
    selectedIndex: clampedIndex,
    filterQuery,
    includeArchived,
    expandedClientIds,
    warning,
    loading: isLoading && !data,
    error: isError ? (error?.message ?? "Unknown error") : null,
  }

  return { state, handleKey, setWarning }
}
