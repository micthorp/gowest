import { useState, useEffect, useCallback, useRef } from 'react'
import { HeroBanner } from './components/HeroBanner'
import { Controls } from './components/Controls'
import { RecommendationCard } from './components/RecommendationCard'
import { TrainList } from './components/TrainList'
import { StatusBanner } from './components/StatusBanner'
import { fetchDepartures } from './lib/api'
import { getRecommendation, sortAndFilterTrains } from './lib/decision'
import { nowTimestamp } from './lib/format'
import type { Direction, Destination, TrainOption } from './lib/stations'
import type { DecisionLabel } from './lib/stations'

const REFRESH_INTERVAL = 30_000

function originFor(direction: Direction, destination: Destination) {
  if (direction === 'homebound') return 'ZFD'
  return destination
}

function destFor(direction: Direction, destination: Destination) {
  if (direction === 'homebound') return destination
  return 'PAD'
}

export default function App() {
  const [direction, setDirection] = useState<Direction>('homebound')
  const [destination, setDestination] = useState<Destination>('MAI')

  const [trains, setTrains] = useState<TrainOption[]>([])
  const [recommendation, setRecommendation] = useState<{ label: DecisionLabel; bestTrain: TrainOption | null } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [disruptionMessage, setDisruptionMessage] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (dir: Direction, dest: Destination, isManual = false) => {
    if (isManual) setLoading(true)
    setError(null)

    try {
      const from = originFor(dir, dest) as any
      const to = destFor(dir, dest) as any
      const data = await fetchDepartures(from, to)

      const sorted = sortAndFilterTrains(data.trains)
      const rec = getRecommendation(data.trains, dir, dest)

      setTrains(sorted)
      setRecommendation(rec)
      setLastUpdated(nowTimestamp())
      setStale(false)

      // Basic disruption detection
      const allBad = data.trains.length > 0 && data.trains.every(t => t.status === 'cancelled')
      const manyDelayed = data.trains.filter(t => t.status === 'delayed').length >= 2
      if (allBad) setDisruptionMessage('All services cancelled or unavailable.')
      else if (manyDelayed) setDisruptionMessage('Multiple delays reported. Check before moving.')
      else setDisruptionMessage(null)

    } catch (e) {
      setError((e as Error).message)
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount and whenever direction/destination changes
  useEffect(() => {
    load(direction, destination)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => load(direction, destination), REFRESH_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [direction, destination, load])

  const handleDirectionChange = (d: Direction) => setDirection(d)
  const handleDestinationChange = (d: Destination) => setDestination(d)
  const handleRefresh = () => load(direction, destination, true)

  return (
    <div className="app">
      <HeroBanner />
      <Controls
        direction={direction}
        destination={destination}
        onDirectionChange={handleDirectionChange}
        onDestinationChange={handleDestinationChange}
      />
      <div className="main">
        {disruptionMessage && <StatusBanner message={disruptionMessage} />}
        {error && stale && (
          <div className="banner visible">
            ⚠ Live data unavailable. Showing last successful update from {lastUpdated}.
          </div>
        )}
        <RecommendationCard
          label={recommendation?.label ?? 'No useful fast option'}
          train={recommendation?.bestTrain ?? null}
        />
        <div className="section-label">Next useful departures</div>
        <TrainList trains={trains} bestId={recommendation?.bestTrain?.id ?? null} />
        <div className="footer">
          <div className="updated">
            {stale ? '⚠ Stale · ' : ''}{lastUpdated ? `Updated ${lastUpdated}` : 'Loading…'}
          </div>
          <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
            <span className={loading ? 'spin' : ''}>↻</span> Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
