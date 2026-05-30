import type { TrainOption } from '../lib/stations'
import type { DecisionLabel } from '../lib/stations'
import { formatTime, formatDuration, operatorLabel, statusLabel } from '../lib/format'
import { STATIONS } from '../lib/stations'

interface Props {
  label: DecisionLabel
  train: TrainOption | null
}

function decisionClass(label: DecisionLabel): string {
  if (label === 'Worth changing at Paddington' || label === 'Check Paddington departures') return 'rec-decision warn'
  if (label === 'Disrupted' || label === 'No useful fast option' || label === 'First moving train wins') return 'rec-decision bad'
  return 'rec-decision'
}

export function RecommendationCard({ label, train }: Props) {
  if (!train) {
    return (
      <div className="rec-card">
        <div className="rec-label">Best option now</div>
        <div className="rec-decision bad">{label}</div>
        <div className="rec-meta">No service data available</div>
      </div>
    )
  }

  const opClass = train.operator === 'GWR' ? 'op-gwr' : 'op-eliz'
  const destName = STATIONS[train.to]?.name ?? train.to
  const estimatedArrival = (() => {
  if (train.estimatedArrival) return train.estimatedArrival
  if (train.estimatedDeparture && train.durationMinutes) {
    const [h, m] = train.estimatedDeparture.split(':').map(Number)
    const total = h * 60 + m + train.durationMinutes
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  return null
})()
  return (
    <div className="rec-card">
      <div className="rec-label">Best option now</div>
      <div className={decisionClass(label)}>{label}</div>
      <div className="rec-row">
        <div className="rec-op">
          <span className={`op-badge ${opClass}`}>{operatorLabel(train.operator)}</span>
          <span>{train.from} → {train.to}</span>
        </div>
        <div className="rec-time">{formatTime(train.estimatedDeparture)}</div>
      </div>
      <div className="rec-meta">
        Arrives {destName} {estimatedArrival ?? '--:--'}
      </div>
      <div className="rec-pills">
        <span className={`pill ${train.isFast ? 'pill-fast' : 'pill-slow'}`}>
          {train.isFast ? 'Fast' : 'Stopping'}
        </span>
        {train.platform && (
          <span className="pill pill-plat">Platform {train.platform}</span>
        )}
        <span className={`pill ${train.status === 'on_time' ? 'pill-ontime' : 'pill-delayed'}`}>
          {statusLabel(train)}
        </span>
        {train.durationMinutes && (
          <span className="pill pill-plat">{formatDuration(train.durationMinutes)}</span>
        )}
      </div>
    </div>
  )
}
