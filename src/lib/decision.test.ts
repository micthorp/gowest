import { describe, expect, it } from 'vitest'
import { disruptionAlert, getRecommendation, sortAndFilterTrains, withChilternBackup } from './decision'
import type { TrainOption } from './stations'

function train(partial: Partial<TrainOption> & Pick<TrainOption, 'id' | 'operator' | 'from' | 'estimatedDeparture'>): TrainOption {
  return {
    to: 'MAI',
    scheduledDeparture: partial.estimatedDeparture,
    status: 'on_time',
    ...partial,
  }
}

describe('getRecommendation homebound', () => {
  it('stays on Elizabeth when the next GWR is uncatchable or the saving is small', () => {
    const trains: TrainOption[] = [
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:42', durationMinutes: 23, isFast: true }),
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:44', durationMinutes: 53 }),
      train({ id: 'g2', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:52', durationMinutes: 24, isFast: true }),
      train({ id: 'e2', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '18:02', durationMinutes: 47 }),
      train({ id: 'g3', operator: 'GWR', from: 'PAD', estimatedDeparture: '18:12', durationMinutes: 22, isFast: true }),
    ]
    // Feeder 17:44 arrives PAD ~17:56 + 8 min interchange → 18:04, so 18:12 GWR is catchable
    // but Elizabeth arrives MAI 18:37 vs GWR 18:34 — only 3 minutes saved.
    const rec = getRecommendation(trains, 'homebound', 'MAI')
    expect(rec.label).toBe('Stay on Elizabeth line')
    expect(rec.bestTrain?.id).toBe('e1')
  })

  it('does not recommend a GWR that leaves Paddington before you can get there', () => {
    const trains: TrainOption[] = [
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:45', durationMinutes: 23, isFast: true }),
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:44', durationMinutes: 53 }),
    ]
    const rec = getRecommendation(trains, 'homebound', 'MAI')
    expect(rec.label).toBe('Stay on Elizabeth line')
    expect(rec.bestTrain?.id).toBe('e1')
  })

  it('recommends changing when a catchable GWR saves at least 8 minutes', () => {
    const rec = getRecommendation(
      [
        train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:50', durationMinutes: 65 }),
        train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '18:20', durationMinutes: 23, isFast: true }),
      ],
      'homebound',
      'MAI'
    )
    // Elizabeth arr 18:55, GWR arr 18:43, saving 12 >= 8
    expect(rec.label).toBe('Worth changing at Paddington')
    expect(rec.bestTrain?.id).toBe('g1')
    expect(rec.detail).toContain('17:50')
    expect(rec.detail).toContain('18:20')
  })

  it('uses the earliest through Elizabeth, not list order', () => {
    const trains: TrainOption[] = [
      train({ id: 'e-later', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '18:10', durationMinutes: 47 }),
      train({ id: 'e-soon', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:50', durationMinutes: 47 }),
    ]
    const rec = getRecommendation(trains, 'homebound', 'MAI')
    expect(rec.bestTrain?.id).toBe('e-soon')
  })

  it('falls back to check Paddington when Elizabeth terminates and GWR is uncatchable', () => {
    const trains: TrainOption[] = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:50', durationMinutes: 12, terminatesPaddington: true }),
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:55', durationMinutes: 23, isFast: true }),
    ]
    const rec = getRecommendation(trains, 'homebound', 'MAI')
    expect(rec.label).toBe('Check Paddington departures')
    expect(rec.bestTrain?.id).toBe('e1')
  })
})

describe('getRecommendation chiltern', () => {
  it('takes the next Chiltern from Marylebone when Beaconsfield is selected', () => {
    const rec = getRecommendation(
      [
        train({ id: 'c-later', operator: 'Chiltern', from: 'MYB', to: 'BCF', estimatedDeparture: '18:10', durationMinutes: 31 }),
        train({ id: 'c-soon', operator: 'Chiltern', from: 'MYB', to: 'BCF', estimatedDeparture: '17:50', durationMinutes: 27 }),
      ],
      'homebound',
      'BCF'
    )
    expect(rec.label).toBe('Take this')
    expect(rec.bestTrain?.id).toBe('c-soon')
    expect(rec.detail).toContain('Marylebone')
  })
})

describe('withChilternBackup', () => {
  it('does not override a healthy Paddington corridor', () => {
    const west = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:44', durationMinutes: 53 }),
    ]
    const chiltern = [
      train({ id: 'c1', operator: 'Chiltern', from: 'MYB', to: 'BCF', estimatedDeparture: '17:50', durationMinutes: 27 }),
    ]
    const westRec = getRecommendation(west, 'homebound', 'MAI')
    const rec = withChilternBackup(westRec, west, chiltern, 'homebound')
    expect(rec.label).toBe('Stay on Elizabeth line')
    expect(rec.bestTrain?.id).toBe('e1')
  })

  it('promotes Chiltern when westbound services are all cancelled', () => {
    const west = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:44', status: 'cancelled' }),
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:42', status: 'cancelled' }),
    ]
    const chiltern = [
      train({ id: 'c1', operator: 'Chiltern', from: 'MYB', to: 'BCF', estimatedDeparture: '17:50', durationMinutes: 27 }),
    ]
    const westRec = getRecommendation(west, 'homebound', 'MAI')
    const rec = withChilternBackup(westRec, west, chiltern, 'homebound')
    expect(rec.label).toBe('Use Chiltern via Marylebone')
    expect(rec.bestTrain?.id).toBe('c1')
  })
})

describe('getRecommendation london-bound', () => {
  it('prefers the next GWR over Elizabeth', () => {
    const trains: TrainOption[] = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'MAI', to: 'PAD', estimatedDeparture: '17:40', durationMinutes: 47 }),
      train({ id: 'g1', operator: 'GWR', from: 'MAI', to: 'PAD', estimatedDeparture: '17:52', durationMinutes: 24, isFast: true }),
    ]
    const rec = getRecommendation(trains, 'london', 'MAI')
    expect(rec.label).toBe('Take this')
    expect(rec.bestTrain?.id).toBe('g1')
  })
})

describe('sortAndFilterTrains', () => {
  it('sorts across midnight', () => {
    const trains: TrainOption[] = [
      train({ id: 'a', operator: 'GWR', from: 'PAD', estimatedDeparture: '00:10' }),
      train({ id: 'b', operator: 'GWR', from: 'PAD', estimatedDeparture: '23:50' }),
    ]
    expect(sortAndFilterTrains(trains).map(t => t.id)).toEqual(['b', 'a'])
  })

  it('hides cancelled trains unless nothing else is running', () => {
    const mixed: TrainOption[] = [
      train({ id: 'ok', operator: 'GWR', from: 'PAD', estimatedDeparture: '18:00' }),
      train({ id: 'cx', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:50', status: 'cancelled' }),
    ]
    expect(sortAndFilterTrains(mixed).map(t => t.id)).toEqual(['ok'])

    const allCx: TrainOption[] = [
      train({ id: 'cx', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:50', status: 'cancelled' }),
    ]
    expect(sortAndFilterTrains(allCx).map(t => t.id)).toEqual(['cx'])
  })
})

describe('disruptionAlert', () => {
  it('flags a missing Elizabeth line when GWR is still running', () => {
    const trains: TrainOption[] = [
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '06:20', durationMinutes: 23, isFast: true }),
      train({ id: 'g2', operator: 'GWR', from: 'PAD', estimatedDeparture: '06:38', durationMinutes: 23, isFast: true }),
      train({ id: 'g3', operator: 'GWR', from: 'PAD', estimatedDeparture: '07:20', durationMinutes: 23, isFast: true }),
    ]
    expect(disruptionAlert(trains, 'MAI')).toBe(
      'Elizabeth line: no services in this window. GWR is still running.'
    )
  })

  it('flags cancelled Elizabeth even if GWR is fine', () => {
    const trains: TrainOption[] = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '06:00', status: 'cancelled' }),
      train({ id: 'e2', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '06:15', status: 'cancelled' }),
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '06:20', durationMinutes: 23, isFast: true }),
      train({ id: 'g2', operator: 'GWR', from: 'PAD', estimatedDeparture: '06:38', durationMinutes: 23, isFast: true }),
    ]
    expect(disruptionAlert(trains, 'MAI')).toBe(
      'Elizabeth line services are cancelled. GWR is still running.'
    )
  })

  it('does not alert when both operators are running', () => {
    const trains: TrainOption[] = [
      train({ id: 'e1', operator: 'Elizabeth', from: 'ZFD', estimatedDeparture: '17:44', durationMinutes: 53 }),
      train({ id: 'g1', operator: 'GWR', from: 'PAD', estimatedDeparture: '17:42', durationMinutes: 23, isFast: true }),
    ]
    expect(disruptionAlert(trains, 'MAI')).toBeNull()
  })
})
