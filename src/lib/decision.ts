import type { TrainOption, DecisionLabel, Destination, Direction } from './stations'
import { addMinutesToHHMM, boardMinutes, compareBoardTimes } from './time'

/** Only switch to GWR if it gets you there at least this many minutes earlier. */
export const SWITCH_THRESHOLD_MINUTES = 8

/** Typical Elizabeth line Farringdon → Paddington running time. */
export const ZFD_TO_PAD_MINUTES = 12

/** Walking / platform-change allowance at Paddington. */
export const PAD_INTERCHANGE_MINUTES = 8

export interface Recommendation {
  label: DecisionLabel
  bestTrain: TrainOption | null
  detail?: string
}

function byDeparture(a: TrainOption, b: TrainOption): number {
  return compareBoardTimes(a.estimatedDeparture, b.estimatedDeparture)
}

function arrivalMinutes(train: TrainOption): number | null {
  if (train.estimatedArrival) {
    const mins = boardMinutes(train.estimatedArrival)
    return Number.isFinite(mins) ? mins : null
  }
  if (!train.durationMinutes) return null
  const dep = boardMinutes(train.estimatedDeparture)
  if (!Number.isFinite(dep)) return null
  return dep + train.durationMinutes
}

function padArrivalFromElizabeth(train: TrainOption): number | null {
  const dep = boardMinutes(train.estimatedDeparture)
  if (!Number.isFinite(dep)) return null
  return dep + ZFD_TO_PAD_MINUTES
}

function earliest(trains: TrainOption[]): TrainOption | undefined {
  return [...trains].sort(byDeparture)[0]
}

export function getRecommendation(
  trains: TrainOption[],
  direction: Direction,
  _destination: Destination
): Recommendation {
  const usable = trains.filter(t => t.status !== 'cancelled')

  if (usable.length === 0) {
    return { label: 'First moving train wins', bestTrain: null }
  }

  const allDisrupted = usable.every(t => t.status === 'delayed' && (t.delayMinutes ?? 0) > 20)
  if (allDisrupted) {
    return { label: 'Disrupted', bestTrain: earliest(usable) ?? null }
  }

  if (direction === 'london') {
    const fast = earliest(usable.filter(t => t.operator === 'GWR'))
    return { label: 'Take this', bestTrain: fast ?? earliest(usable) ?? null }
  }

  const elizabethFromZfd = usable.filter(t => t.operator === 'Elizabeth' && t.from === 'ZFD')
  const throughElizabeth = earliest(elizabethFromZfd.filter(t => !t.terminatesPaddington))
  const terminatingElizabeth = earliest(elizabethFromZfd.filter(t => t.terminatesPaddington))
  const feeder = throughElizabeth ?? terminatingElizabeth

  const gwrFromPad = usable.filter(t => t.operator === 'GWR' && t.from === 'PAD').sort(byDeparture)

  const feederArrivesPad = feeder ? padArrivalFromElizabeth(feeder) : null
  const catchableGwr = gwrFromPad.find(gwr => {
    if (feederArrivesPad === null) return false
    const gwrDep = boardMinutes(gwr.estimatedDeparture)
    if (!Number.isFinite(gwrDep)) return false
    return gwrDep >= feederArrivesPad + PAD_INTERCHANGE_MINUTES
  })

  const changeDetail = (gwr: TrainOption) => {
    if (!feeder) return undefined
    return `Take the ${feeder.estimatedDeparture} Elizabeth to Paddington, then ${gwr.estimatedDeparture} GWR`
  }

  if (!throughElizabeth && terminatingElizabeth) {
    if (catchableGwr) {
      return {
        label: 'Worth changing at Paddington',
        bestTrain: catchableGwr,
        detail: changeDetail(catchableGwr),
      }
    }
    return { label: 'Check Paddington departures', bestTrain: terminatingElizabeth }
  }

  if (throughElizabeth && catchableGwr) {
    const elizArr = arrivalMinutes(throughElizabeth)
    const gwrArr = arrivalMinutes(catchableGwr)
    if (elizArr !== null && gwrArr !== null) {
      const saving = elizArr - gwrArr
      if (saving >= SWITCH_THRESHOLD_MINUTES) {
        return {
          label: 'Worth changing at Paddington',
          bestTrain: catchableGwr,
          detail: changeDetail(catchableGwr),
        }
      }
      return { label: 'Stay on Elizabeth line', bestTrain: throughElizabeth }
    }
  }

  if (catchableGwr && !throughElizabeth) {
    return {
      label: 'Worth changing at Paddington',
      bestTrain: catchableGwr,
      detail: changeDetail(catchableGwr),
    }
  }

  if (throughElizabeth) {
    return { label: 'Stay on Elizabeth line', bestTrain: throughElizabeth }
  }

  if (gwrFromPad[0]) {
    return {
      label: 'Check Paddington departures',
      bestTrain: gwrFromPad[0],
      detail: 'No Elizabeth feeder from Farringdon in this window — GWR may not be catchable.',
    }
  }

  return { label: 'No useful fast option', bestTrain: earliest(usable) ?? null }
}

export function sortAndFilterTrains(trains: TrainOption[]): TrainOption[] {
  const active = trains.filter(t => t.status !== 'cancelled')
  const source = active.length > 0 ? active : trains
  return [...source].sort(byDeparture).slice(0, 6)
}

export function estimatedArrivalHHMM(train: TrainOption): string | null {
  if (train.estimatedArrival && /^\d{2}:\d{2}$/.test(train.estimatedArrival)) {
    return train.estimatedArrival
  }
  if (train.durationMinutes && train.estimatedDeparture) {
    return addMinutesToHHMM(train.estimatedDeparture, train.durationMinutes)
  }
  return null
}
