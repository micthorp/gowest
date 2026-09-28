/** Minutes from midnight for an HH:MM string. Invalid values sort last. */
export function minutesFromHHMM(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Sort key for departure boards that may span midnight.
 * Times between 00:00 and 03:59 are treated as after the previous evening.
 */
export function boardMinutes(hhmm: string): number {
  const mins = minutesFromHHMM(hhmm)
  if (mins === null) return Number.POSITIVE_INFINITY
  return mins < 4 * 60 ? mins + 24 * 60 : mins
}

export function addMinutesToHHMM(hhmm: string, duration: number): string | null {
  const mins = minutesFromHHMM(hhmm)
  if (mins === null) return null
  const total = ((mins + duration) % (24 * 60) + 24 * 60) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function compareBoardTimes(a: string, b: string): number {
  return boardMinutes(a) - boardMinutes(b)
}
