import { describe, expect, it } from 'vitest'
import { advertisedTimeToHHMM } from './time'

describe('advertisedTimeToHHMM', () => {
  it('passes through HH:MM', () => {
    expect(advertisedTimeToHHMM('20:38')).toBe('20:38')
  })

  it('uses the clock digits from a naive ISO datetime', () => {
    expect(advertisedTimeToHHMM('2026-09-30T20:38:00')).toBe('20:38')
  })

  it('does not shift GBTT times tagged as UTC', () => {
    expect(advertisedTimeToHHMM('2026-09-30T20:38:00Z')).toBe('20:38')
  })

  it('keeps BST offset datetimes on the advertised clock', () => {
    expect(advertisedTimeToHHMM('2026-09-30T20:38:00+01:00')).toBe('20:38')
  })
})
