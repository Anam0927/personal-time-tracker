import type { StartResult, SwitchResult } from "@/features/tracking/service"

export const shouldExitNormally = (input: string, isEscape: boolean): boolean => {
  if (isEscape) {
    return true
  }

  const normalizedInput = input.trim().toLowerCase()
  return normalizedInput === "q" || normalizedInput === "x"
}

/**
 * Maps timer result variants to user-friendly error messages.
 * Returns null for success variants so callers know success.
 */
export function getResultMessage(result: StartResult | SwitchResult): string | null {
  switch (result.variant) {
    case "started":
    case "switched":
      return null
    case "sameActive":
      return "This project is already being tracked."
    case "conflict":
      return "A different timer is already running. Please switch instead."
    case "noActiveToSwitch":
      return "No active timer to switch from."
    case "transitionFailed":
      return "Failed to switch. The timer state may have changed."
    case "clientNotFound":
      return "Client not found."
    case "projectNotFound":
      return "Project not found."
    case "clientArchived":
      return "This client is archived."
    case "projectArchived":
      return "This project is archived."
    case "tagResolutionFailed":
      return "Could not resolve tags."
    default:
      return "An unexpected error occurred."
  }
}
