import type { TrainOption } from '../lib/stations'
import { formatTime, operatorLabel, statusLabel } from '../lib/format'

interface Props {
  trains: TrainOption[]
  bestId: string | null
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
        const statusCls =
          train.status === 'on_time' ? 'status-ontime' :
          train.status === 'delayed' ? 'status-delayed' : 'status-cancelled'

        return (
          <div key={train.id} className={`train-row ${isBest ? 'best' : ''}`}>
            <div className="train-depart">{formatTime(train.estimatedDeparture)}</div>
            <div>
              <span className={`op-badge ${opClass}`} style={{ fontSize: '10px' }}>
                {operatorLabel(train.operator)}
              </span>
              <div className="train-route">
                {train.from} → {train.to}
                {train.durationMinutes ? ` · ${train.durationMinutes}m` : ''}
                {train.isFast ? ' · Fast' : ''}
              </div>
              <div className="train-arr">
                arr {formatTime(train.estimatedArrival ?? train.scheduledArrival ?? '')}
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
