export const shouldExitNormally = (input: string, isEscape: boolean): boolean => {
  if (isEscape) {
    return true
  }

  const normalizedInput = input.trim().toLowerCase()
  return normalizedInput === "q" || normalizedInput === "x"
}
