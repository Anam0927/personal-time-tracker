import { Box, Text, useStdout } from "ink"
import BigText from "ink-big-text"

interface ShellProps {
  children: React.ReactNode
}

export function Shell({ children }: ShellProps) {
  const { stdout } = useStdout()

  const terminalHeight = stdout.rows

  return (
    <Box flexDirection="column" height={terminalHeight} justifyContent="space-between">
      {/* Header */}
      <Box>
        <BigText
          text="Time Tracker"
          colors={["green", "blue"]}
          align="center"
          font="tiny"
          space={false}
        />
      </Box>

      {/* Content */}
      <Box flexGrow={1} paddingX={2} paddingY={1} borderStyle="single" borderColor="blue">
        {children}
      </Box>

      {/* Footer */}
      <Box
        borderStyle="single"
        borderColor="gray"
        borderDimColor
        borderRight={false}
        borderLeft={false}
        borderBottom={false}
      >
        <Text dimColor color="gray">
          Press 'q', 'x', or 'Esc' to exit.
        </Text>
      </Box>
    </Box>
  )
}
