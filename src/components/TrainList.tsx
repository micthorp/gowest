import type { TrainOption } from '../lib/stations'
import { formatTime, operatorLabel, statusLabel } from '../lib/format'

interface Props {
  trains: TrainOption[]
  bestId: string | null
}

function calcArr(train: TrainOption): string {
  if (train.estimatedArrival) return formatTime(train.estimatedArrival)
  if (train.estimatedDeparture && train.durationMinutes) {
    const [h, m] = train.estimatedDeparture.split(':').map(Number)
    const total = h * 60 + m + train.durationMinutes
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  return '--:--'
}

export function TrainList({ trains, bestId }: Props) {
  if (trains.length === 0) {
    return (
      <div className="train-list">
        <div className="train-row">
          <div style={{ gridColumn: '1/-1', color: 'var(--gw-muted)', fontSize: '12px' }}>
            No departures found
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="train-list">
      {trains.map(train => {
        const opClass = train.operator === 'GWR' ? 'op-gwr' : 'op-eliz'
        const isBest = train.id === bestId
        const requiresChange = train.from === 'PAD'
        const statusCls =
          train.status === 'on_time' ? 'status-ontime' :
          train.status === 'delayed' ? 'status-delayed' : 'status-cancelled'

        return (
          <div key={`${train.id}-${train.from}`} className={`train-row ${isBest ? 'best' : ''}`}>
            <div className="train-depart">{formatTime(train.estimatedDeparture)}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                <span className={`op-badge ${opClass}`} style={{ fontSize: '10px' }}>
                  {operatorLabel(train.operator)}
                </span>
                {requiresChange && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                    borderRadius: '2px', background: '#2a1e00',
                    color: 'var(--gw-gold)', border: '1px solid var(--gw-gold)',
                    letterSpacing: '0.5px', textTransform: 'uppercase'
                  }}>
                    Change at PAD
                  </span>
                )}
              </div>
              <div className="train-route">
                {train.from} → {train.to}
                {train.durationMinutes ? ` · ${train.durationMinutes}m` : ''}
                {train.isFast ? ' · Fast' : ''}
              </div>
              <div className="train-arr">
                arr {calcArr(train)}
                {train.platform ? ` · Plat ${train.platform}` : ''}
              </div>
            </div>
            <div />
            <div style={{ textAlign: 'right' }}>
              <span className={`train-status ${statusCls}`}>{statusLabel(train)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
