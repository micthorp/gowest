import type { TrainOption, DecisionLabel, Destination, Direction } from './stations'

const SWITCH_THRESHOLD_MINUTES = 8

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function arrivalMinutes(train: TrainOption): number | null {
  const arr = train.estimatedArrival ?? train.scheduledArrival
  if (!arr) return null
  return parseTime(arr)
}

export function getRecommendation(
  trains: TrainOption[],
  direction: Direction,
  _destination: Destination
): { label: DecisionLabel; bestTrain: TrainOption | null } {
  const usable = trains.filter(t => t.status !== 'cancelled')

  if (usable.length === 0) {
    return { label: 'First moving train wins', bestTrain: null }
  }

  const allDisrupted = usable.every(t => t.status === 'delayed' && (t.delayMinutes ?? 0) > 20)
  if (allDisrupted) {
    return { label: 'Disrupted', bestTrain: usable[0] }
  }

  if (direction === 'london') {
    // For London-bound: prefer fast GWR, fall back to Elizabeth
    const fast = usable.find(t => t.isFast && t.status !== 'cancelled')
    const best = fast ?? usable[0]
    return { label: 'Take this', bestTrain: best }
  }

  // Homebound logic
  const directElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.from === 'ZFD' && !t.terminatesPaddington
  )
  const terminatingElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.terminatesPaddington
  )
  const gwrFromPad = usable.find(
    t => (t.operator === 'GWR' || t.operator === 'Elizabeth') && t.from === 'PAD' && t.isFast
  )

  // No through Elizabeth line — nudge to check Paddington
  if (!directElizabeth && terminatingElizabeth) {
    if (gwrFromPad) {
      return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
    }
    return { label: 'Check Paddington departures', bestTrain: terminatingElizabeth }
  }

  // Compare direct Elizabeth vs GWR from Paddington
  if (directElizabeth && gwrFromPad) {
    const elizArr = arrivalMinutes(directElizabeth)
    const gwrArr = arrivalMinutes(gwrFromPad)

    if (elizArr !== null && gwrArr !== null) {
      const saving = elizArr - gwrArr
      if (saving >= SWITCH_THRESHOLD_MINUTES) {
        return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
      } else {
        return { label: 'Stay on Elizabeth line', bestTrain: directElizabeth }
      }
    }
  }

  // Only GWR available
  if (gwrFromPad && !directElizabeth) {
    return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
  }

  // Only Elizabeth available
  if (directElizabeth) {
    return { label: 'Stay on Elizabeth line', bestTrain: directElizabeth }
  }

  return { label: 'No useful fast option', bestTrain: usable[0] ?? null }
}

export function sortAndFilterTrains(trains: TrainOption[]): TrainOption[] {
  return trains
    .filter(t => t.status !== 'cancelled' || trains.filter(u => u.status !== 'cancelled').length === 0)
    .sort((a, b) => {
      const ta = parseTime(a.estimatedDeparture || a.scheduledDeparture)
      const tb = parseTime(b.estimatedDeparture || b.scheduledDeparture)
      return ta - tb
    })
    .slice(0, 5)
}
