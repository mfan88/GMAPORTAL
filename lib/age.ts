const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/** Parse an EDC value as a local calendar date (YYYY-MM-DD preferred). */
export function parseEdcDate(edc: string | null | undefined): Date | null {
  if (!edc || typeof edc !== "string") return null
  const trimmed = edc.trim()
  if (!trimmed) return null

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date
    }
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/**
 * Whole weeks from EDC to a recorded date (local calendar days).
 * Returns null if either date is invalid.
 */
export function weeksFromEdcToDate(
  edc: string | null | undefined,
  recorded: Date
): number | null {
  const edcDate = parseEdcDate(edc)
  if (!edcDate || Number.isNaN(recorded.getTime())) return null

  const recordedDay = new Date(
    recorded.getFullYear(),
    recorded.getMonth(),
    recorded.getDate()
  )
  const diffMs = recordedDay.getTime() - edcDate.getTime()
  return Math.max(0, Math.floor(diffMs / MS_PER_WEEK))
}
