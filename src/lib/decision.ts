import type { TrainOption, DecisionLabel, Destination, Direction } from './stations'

const SWITCH_THRESHOLD_MINUTES = 8

function depMinutes(train: TrainOption): number {
  const [h, m] = train.estimatedDeparture.split(':').map(Number)
  return h * 60 + m
}

function arrMinutes(train: TrainOption): number | null {
  if (!train.durationMinutes) return null
  return depMinutes(train) + train.durationMinutes
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
    const fast = usable.find(t => t.isFast && t.status !== 'cancelled')
    const best = fast ?? usable[0]
    return { label: 'Take this', bestTrain: best }
  }

  // Homebound logic — compare direct Elizabeth from ZFD vs GWR from PAD
  const directElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.from === 'ZFD' && !t.terminatesPaddington
  )
  const gwrFromPad = usable.find(
    t => t.operator === 'GWR' && t.from === 'PAD'
  )
  const terminatingElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.terminatesPaddington
  )

  // No through Elizabeth line
  if (!directElizabeth && terminatingElizabeth) {
    if (gwrFromPad) return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
    return { label: 'Check Paddington departures', bestTrain: terminatingElizabeth }
  }

  // Compare direct Elizabeth vs GWR from Paddington
  if (directElizabeth && gwrFromPad) {
    const elizArr = arrMinutes(directElizabeth)
    const gwrArr = arrMinutes(gwrFromPad)

    if (elizArr !== null && gwrArr !== null) {
      const saving = elizArr - gwrArr
      if (saving >= SWITCH_THRESHOLD_MINUTES) {
        return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
      } else {
        return { label: 'Stay on Elizabeth line', bestTrain: directElizabeth }
      }
    }
  }

  if (gwrFromPad && !directElizabeth) {
    return { label: 'Worth changing at Paddington', bestTrain: gwrFromPad }
  }

  if (directElizabeth) {
    return { label: 'Stay on Elizabeth line', bestTrain: directElizabeth }
  }

  return { label: 'No useful fast option', bestTrain: usable[0] ?? null }
}

export function sortAndFilterTrains(trains: TrainOption[]): TrainOption[] {
  return trains
    .filter(t => t.status !== 'cancelled' || trains.filter(u => u.status !== 'cancelled').length === 0)
    .sort((a, b) => {
      const [ah, am] = a.estimatedDeparture.split(':').map(Number)
      const [bh, bm] = b.estimatedDeparture.split(':').map(Number)
      return (ah * 60 + am) - (bh * 60 + bm)
    })
    .slice(0, 5)
}