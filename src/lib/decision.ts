import type { TrainOption, DecisionLabel, Destination, Direction } from './stations'

const SWITCH_THRESHOLD_MINUTES = 8

function arrMinutes(train: TrainOption): number | null {
  const [h, m] = train.estimatedDeparture.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  const dep = h * 60 + m
  if (!train.durationMinutes) return null
  return dep + train.durationMinutes
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
    return { label: 'Take this', bestTrain: fast ?? usable[0] }
  }

  // Homebound — find best Elizabeth from ZFD and best GWR from PAD
  const bestElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.from === 'ZFD' && !t.terminatesPaddington
  )
  const bestGWR = usable.find(
    t => t.operator === 'GWR' && t.from === 'PAD'
  )
  const terminatingElizabeth = usable.find(
    t => t.operator === 'Elizabeth' && t.terminatesPaddington
  )

  // No through Elizabeth line at all
  if (!bestElizabeth && terminatingElizabeth) {
    if (bestGWR) return { label: 'Worth changing at Paddington', bestTrain: bestGWR }
    return { label: 'Check Paddington departures', bestTrain: terminatingElizabeth }
  }

  // Compare next Elizabeth arrival vs next GWR arrival
  if (bestElizabeth && bestGWR) {
    const elizArr = arrMinutes(bestElizabeth)
    const gwrArr = arrMinutes(bestGWR)

    if (elizArr !== null && gwrArr !== null) {
      const saving = elizArr - gwrArr
      if (saving >= SWITCH_THRESHOLD_MINUTES) {
        return { label: 'Worth changing at Paddington', bestTrain: bestGWR }
      } else {
        return { label: 'Stay on Elizabeth line', bestTrain: bestElizabeth }
      }
    }
  }

  if (bestGWR && !bestElizabeth) {
    return { label: 'Worth changing at Paddington', bestTrain: bestGWR }
  }

  if (bestElizabeth) {
    return { label: 'Stay on Elizabeth line', bestTrain: bestElizabeth }
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
    .slice(0, 6)
}
