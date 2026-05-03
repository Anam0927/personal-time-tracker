import { Box, Text } from "ink"

import type { BrowserState } from "../../lib/use-browser-state"

export function BrowserView({ state }: { state: BrowserState }): React.JSX.Element {
  const showLoading = state.loading && state.flatItems.length === 0
  const showError = state.error !== null && state.flatItems.length === 0
  const showEmptyFilter = !showLoading && !showError && state.flatItems.length === 0

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
      <Box>
        <Text bold> Clients {`&`} Projects </Text>
      </Box>

      <Box>
        <Text>
          {"> "}
          {state.filterQuery}
          <Text inverse> </Text>
        </Text>
      </Box>

      {showLoading ? (
        <Text dimColor>Loading...</Text>
      ) : showError ? (
        <Text color="red">Error: {state.error}</Text>
      ) : showEmptyFilter ? (
        <Text dimColor>No matches</Text>
      ) : (
        <Box flexDirection="column">
          {state.flatItems.map((item, i) => {
            const isSelected = i === state.selectedIndex
            const prefix = isSelected ? " " : "  "
            const indent = "  ".repeat(item.depth)

            if (item.type === "client") {
              const expandIcon = item.isExpanded ? "▼" : "▶"
              return (
                <Text
                  key={item.id}
                  inverse={isSelected}
                  color={item.archived ? "gray" : undefined}
                  bold
                >
                  {prefix}
                  {indent}
                  {expandIcon} {item.label}
                </Text>
              )
            }

            const activePrefix = item.isActive ? "●" : " "
            return (
              <Text
                key={item.id}
                inverse={isSelected}
                color={item.archived ? "gray" : undefined}
                bold={item.isActive}
              >
                {prefix}
                {indent}
                {activePrefix} {item.label}
              </Text>
            )
          })}
        </Box>
      )}

      {state.warning !== null ? (
        <Text color="yellow" dimColor>
          {state.warning}
        </Text>
      ) : null}
    </Box>
  )
}
