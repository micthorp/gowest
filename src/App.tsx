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
import type { Recommendation } from './lib/decision'

const REFRESH_INTERVAL = 30_000
const PREFS_KEY = 'gowest-prefs'

function originFor(direction: Direction, destination: Destination) {
  if (direction === 'homebound') return 'ZFD' as const
  return destination
}

function destFor(direction: Direction, destination: Destination) {
  if (direction === 'homebound') return destination
  return 'PAD' as const
}

function loadPrefs(): { direction: Direction; destination: Destination } {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { direction: 'homebound', destination: 'MAI' }
    const parsed = JSON.parse(raw) as { direction?: string; destination?: string }
    const direction: Direction = parsed.direction === 'london' ? 'london' : 'homebound'
    const destination: Destination = parsed.destination === 'RDG' ? 'RDG' : 'MAI'
    return { direction, destination }
  } catch {
    return { direction: 'homebound', destination: 'MAI' }
  }
}

export default function App() {
  const [direction, setDirection] = useState<Direction>(() => loadPrefs().direction)
  const [destination, setDestination] = useState<Destination>(() => loadPrefs().destination)

  const [trains, setTrains] = useState<TrainOption[]>([])
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [disruptionMessage, setDisruptionMessage] = useState<string | null>(null)

  const inflightRef = useRef<AbortController | null>(null)

  const persist = (nextDir: Direction, nextDest: Destination) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ direction: nextDir, destination: nextDest }))
    } catch {
      // ignore quota / private mode
    }
  }

  const load = useCallback(async (dir: Direction, dest: Destination, isManual = false) => {
    inflightRef.current?.abort()
    const controller = new AbortController()
    inflightRef.current = controller

    if (isManual) setLoading(true)
    setError(null)

    try {
      const from = originFor(dir, dest)
      const to = destFor(dir, dest)
      const data = await fetchDepartures(from, to, controller.signal)
      if (controller.signal.aborted) return

      const sorted = sortAndFilterTrains(data.trains)
      const rec = getRecommendation(data.trains, dir, dest)

      setTrains(sorted)
      setRecommendation(rec)
      setLastUpdated(nowTimestamp())
      setStale(false)

      const allBad = data.trains.length > 0 && data.trains.every(t => t.status === 'cancelled')
      const manyDelayed = data.trains.filter(t => t.status === 'delayed').length >= 2
      if (allBad) setDisruptionMessage('All services cancelled or unavailable.')
      else if (manyDelayed) setDisruptionMessage('Multiple delays reported. Check before moving.')
      else setDisruptionMessage(null)
    } catch (e) {
      if (controller.signal.aborted || (e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setStale(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(direction, destination)
    const timer = setInterval(() => load(direction, destination), REFRESH_INTERVAL)
    return () => {
      clearInterval(timer)
      inflightRef.current?.abort()
    }
  }, [direction, destination, load])

  const handleDirectionChange = (d: Direction) => {
    setDirection(d)
    persist(d, destination)
  }
  const handleDestinationChange = (d: Destination) => {
    setDestination(d)
    persist(direction, d)
  }
  const handleRefresh = () => load(direction, destination, true)

  const staleMessage = lastUpdated
    ? `Live data unavailable. Showing last successful update from ${lastUpdated}.`
    : 'Live data unavailable.'

  return (
    <div className="app">
      <h1 className="visually-hidden">GoWest</h1>
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
            ⚠ {staleMessage}
          </div>
        )}
        {loading && trains.length === 0 && !error ? (
          <div className="rec-card">
            <div className="rec-label">Best option now</div>
            <div className="rec-decision">Checking services…</div>
          </div>
        ) : (
          <RecommendationCard
            label={recommendation?.label ?? 'No useful fast option'}
            train={recommendation?.bestTrain ?? null}
            detail={recommendation?.detail}
          />
        )}
        <div className="section-label">Next useful departures</div>
        <TrainList trains={trains} bestId={recommendation?.bestTrain?.id ?? null} />
        <div className="footer">
          <div className="updated">
            {stale ? '⚠ Stale · ' : ''}{lastUpdated ? `Updated ${lastUpdated}` : 'Loading…'}
          </div>
          <button className="refresh-btn" onClick={handleRefresh} disabled={loading} type="button">
            <span className={loading ? 'spin' : ''}>↻</span> Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
