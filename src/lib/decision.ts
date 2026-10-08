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

const LAST_RESORT_LABELS: DecisionLabel[] = [
  'Disrupted',
  'First moving train wins',
  'No useful fast option',
]

export function getRecommendation(
  trains: TrainOption[],
  direction: Direction,
  destination: Destination
): Recommendation {
  const usable = trains.filter(t => t.status !== 'cancelled')

  if (usable.length === 0) {
    return { label: 'First moving train wins', bestTrain: null }
  }

  const allDisrupted = usable.every(t => t.status === 'delayed' && (t.delayMinutes ?? 0) > 20)
  if (allDisrupted) {
    return { label: 'Disrupted', bestTrain: earliest(usable) ?? null }
  }

  if (destination === 'BCF') {
    const chiltern = earliest(usable.filter(t => t.operator === 'Chiltern'))
    return {
      label: 'Take this',
      bestTrain: chiltern ?? earliest(usable) ?? null,
      detail: direction === 'homebound'
        ? 'Chiltern from Marylebone to Beaconsfield'
        : 'Chiltern from Beaconsfield to Marylebone',
    }
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
    const elizCancelled = trains.some(t => t.operator === 'Elizabeth' && t.status === 'cancelled')
    return {
      label: 'Check Paddington departures',
      bestTrain: gwrFromPad[0],
      detail: elizCancelled
        ? 'Elizabeth line services are cancelled. Next GWR from Paddington.'
        : 'No Elizabeth feeder from Farringdon in this window — GWR may not be catchable.',
    }
  }

  return { label: 'No useful fast option', bestTrain: earliest(usable) ?? null }
}

/** Promote Chiltern when the Paddington / Elizabeth corridor has nothing useful. */
export function withChilternBackup(
  westRec: Recommendation,
  westTrains: TrainOption[],
  chilternTrains: TrainOption[],
  direction: Direction
): Recommendation {
  const usableWest = westTrains.filter(t => t.status !== 'cancelled')
  const westFailed = LAST_RESORT_LABELS.includes(westRec.label) || usableWest.length === 0
  if (!westFailed) return westRec

  const nextChiltern = earliest(chilternTrains.filter(t => t.status !== 'cancelled' && t.operator === 'Chiltern'))
    ?? earliest(chilternTrains.filter(t => t.status !== 'cancelled'))
  if (!nextChiltern) return westRec

  return {
    label: 'Use Chiltern via Marylebone',
    bestTrain: nextChiltern,
    detail: direction === 'homebound'
      ? 'Paddington corridor looks poor. Next Chiltern from Marylebone to Beaconsfield.'
      : 'Paddington corridor looks poor. Next Chiltern from Beaconsfield to Marylebone.',
  }
}

function runningBy(trains: TrainOption[], operator: TrainOption['operator']): TrainOption[] {
  return trains.filter(t => t.operator === operator && t.status !== 'cancelled')
}

function cancelledBy(trains: TrainOption[], operator: TrainOption['operator']): TrainOption[] {
  return trains.filter(t => t.operator === operator && t.status === 'cancelled')
}

/**
 * In-app alert for a wiped-out operator. RTT often omits cancelled trains
 * entirely, so "zero Elizabeth + several GWR" is the Wednesday engineering case.
 */
export function disruptionAlert(
  trains: TrainOption[],
  destination: Destination,
  rttAlerts: string[] = []
): string | null {
  if (destination === 'BCF') {
    const running = runningBy(trains, 'Chiltern')
    const cancelled = cancelledBy(trains, 'Chiltern')
    if (running.length === 0 && cancelled.length >= 2) {
      return 'Chiltern services are cancelled in this window.'
    }
    if (cancelled.length >= 2) {
      return 'Multiple Chiltern cancellations. Check before travelling.'
    }
    const delayed = trains.filter(t => t.status === 'delayed').length
    if (delayed >= 2) return 'Multiple delays reported. Check before travelling.'
    return rttAlerts[0] ?? null
  }

  const elizRun = runningBy(trains, 'Elizabeth')
  const gwrRun = runningBy(trains, 'GWR')
  const elizCx = cancelledBy(trains, 'Elizabeth')
  const gwrCx = cancelledBy(trains, 'GWR')

  const elizMissing = elizRun.length === 0 && elizCx.length === 0
  const gwrMissing = gwrRun.length === 0 && gwrCx.length === 0

  if (elizRun.length === 0 && gwrRun.length === 0 && trains.length > 0) {
    return 'Paddington / Elizabeth corridor looks down. Check Chiltern via Marylebone.'
  }

  // No Elizabeth at all, but GWR is running — typical of an Elizabeth shutdown
  // where cancelled XR services never appear in the RTT location feed.
  if (elizRun.length === 0 && gwrRun.length >= 2 && (elizMissing || elizCx.length > 0)) {
    return elizCx.length > 0
      ? 'Elizabeth line services are cancelled. GWR is still running.'
      : 'Elizabeth line: no services in this window. GWR is still running.'
  }

  if (gwrRun.length === 0 && elizRun.length >= 2 && (gwrMissing || gwrCx.length > 0)) {
    return gwrCx.length > 0
      ? 'GWR services are cancelled. Elizabeth line is still running.'
      : 'No GWR in this window. Elizabeth line is still running.'
  }

  const delayed = trains.filter(t => t.status === 'delayed').length
  if (delayed >= 2) {
    return 'Multiple delays reported. Check before moving.'
  }

  return rttAlerts[0] ?? null
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
