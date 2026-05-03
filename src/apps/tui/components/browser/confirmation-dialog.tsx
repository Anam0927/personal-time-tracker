import { Box, Text, useInput } from "ink"

export interface ConfirmationDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}

export function ConfirmationDialog(props: ConfirmationDialogProps): React.JSX.Element {
  useInput((_input, key) => {
    if (props.disabled) {
      return
    }

    if (key.return) {
      props.onConfirm()
      return
    }

    if (key.escape) {
      props.onCancel()
      return
    }
  })

  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
      <Text>{props.message}</Text>
      <Text dimColor>Enter to confirm · Esc to cancel</Text>
    </Box>
  )
}
