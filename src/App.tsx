import { useState, useEffect, useCallback, useRef } from 'react'
import { HeroBanner } from './components/HeroBanner'
import { Controls } from './components/Controls'
import { RecommendationCard } from './components/RecommendationCard'
import { TrainList } from './components/TrainList'
import { StatusBanner } from './components/StatusBanner'
import { fetchDepartures } from './lib/api'
import { disruptionAlert, getRecommendation, sortAndFilterTrains, withChilternBackup } from './lib/decision'
import { nowTimestamp } from './lib/format'
import {
  chilternBackupRoute,
  isChilternDestination,
  routeFor,
  type Direction,
  type Destination,
  type TrainOption,
} from './lib/stations'
import type { Recommendation } from './lib/decision'

const REFRESH_INTERVAL = 30_000
const PREFS_KEY = 'gowest-prefs'

function parseDestination(value?: string): Destination {
  if (value === 'RDG' || value === 'BCF' || value === 'BEF') return value === 'BEF' ? 'BCF' : value
  return 'MAI'
}

function loadPrefs(): { direction: Direction; destination: Destination } {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { direction: 'homebound', destination: 'MAI' }
    const parsed = JSON.parse(raw) as { direction?: string; destination?: string }
    const direction: Direction = parsed.direction === 'london' ? 'london' : 'homebound'
    return { direction, destination: parseDestination(parsed.destination) }
  } catch {
    return { direction: 'homebound', destination: 'MAI' }
  }
}

export default function App() {
  const [direction, setDirection] = useState<Direction>(() => loadPrefs().direction)
  const [destination, setDestination] = useState<Destination>(() => loadPrefs().destination)

  const [trains, setTrains] = useState<TrainOption[]>([])
  const [backupTrains, setBackupTrains] = useState<TrainOption[]>([])
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

  const load = useCallback(async (dir: Direction, dest: Destination, mode: 'auto' | 'manual' | 'silent' = 'auto') => {
    inflightRef.current?.abort()
    const controller = new AbortController()
    inflightRef.current = controller

    if (mode !== 'silent') setLoading(true)
    if (mode === 'auto') {
      setTrains([])
      setBackupTrains([])
      setRecommendation(null)
      setDisruptionMessage(null)
    }
    setError(null)

    try {
      const { from, to } = routeFor(dir, dest)
      const backup = isChilternDestination(dest) ? null : chilternBackupRoute(dir)

      const [mainSettled, backupSettled] = await Promise.allSettled([
        fetchDepartures(from, to, controller.signal),
        backup
          ? fetchDepartures(backup.from, backup.to, controller.signal)
          : Promise.resolve(null),
      ])
      if (controller.signal.aborted) return

      const isAbort = (reason: unknown) =>
        controller.signal.aborted || (reason as Error).name === 'AbortError'

      if (mainSettled.status === 'rejected' && isAbort(mainSettled.reason)) return
      if (backupSettled.status === 'rejected' && isAbort(backupSettled.reason)) return

      const backupData = backupSettled.status === 'fulfilled' ? backupSettled.value : null
      const sortedBackup = backupData ? sortAndFilterTrains(backupData.trains) : []

      if (mainSettled.status === 'rejected') {
        const nextChiltern = sortedBackup.find(t => t.status !== 'cancelled') ?? sortedBackup[0] ?? null
        if (!nextChiltern) throw mainSettled.reason
        setTrains([])
        setBackupTrains(sortedBackup)
        setRecommendation({
          label: 'Use Chiltern via Marylebone',
          bestTrain: nextChiltern,
          detail: 'Could not load Paddington corridor. Showing Chiltern via Marylebone.',
        })
        setLastUpdated(nowTimestamp())
        setStale(true)
        setError((mainSettled.reason as Error).message)
        setDisruptionMessage('Paddington corridor unavailable. Chiltern via Marylebone is the backup.')
        return
      }

      const data = mainSettled.value
      const sorted = sortAndFilterTrains(data.trains)
      let rec = getRecommendation(data.trains, dir, dest)
      if (backupData) {
        rec = withChilternBackup(rec, data.trains, backupData.trains, dir)
      }

      setTrains(sorted)
      setBackupTrains(sortedBackup)
      setRecommendation(rec)
      setLastUpdated(nowTimestamp())
      setStale(false)

      const alert = disruptionAlert(data.trains, dest, data.alerts ?? [])
      if (alert) {
        setDisruptionMessage(alert)
      } else if (rec.label === 'Use Chiltern via Marylebone') {
        setDisruptionMessage('Paddington corridor looks poor. Chiltern via Marylebone is the backup.')
      } else {
        setDisruptionMessage(null)
      }
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
    const timer = setInterval(() => load(direction, destination, 'silent'), REFRESH_INTERVAL)
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
  const handleRefresh = () => load(direction, destination, 'manual')

  const staleMessage = lastUpdated
    ? `Live data unavailable. Showing last successful update from ${lastUpdated}.`
    : 'Live data unavailable.'

  const backupLabel = direction === 'homebound'
    ? 'Chiltern backup · Marylebone → Beaconsfield'
    : 'Chiltern backup · Beaconsfield → Marylebone'

  const showChilternBackup = !isChilternDestination(destination)

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
        {showChilternBackup && (backupTrains.length > 0 || (!loading && lastUpdated)) && (
          <>
            <div className="section-label backup-label">{backupLabel}</div>
            <TrainList trains={backupTrains} bestId={recommendation?.bestTrain?.id ?? null} />
          </>
        )}
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
