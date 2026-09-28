import type { TrainOption } from '../lib/stations'
import { formatTime, operatorLabel, operatorClass, statusLabel } from '../lib/format'
import { estimatedArrivalHHMM } from '../lib/decision'

interface Props {
  trains: TrainOption[]
  bestId: string | null
}

export function TrainList({ trains, bestId }: Props) {
  if (trains.length === 0) {
    return (
      <div className="train-list">
        <div className="train-row">
          <div className="train-empty">No departures found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="train-list">
      {trains.map(train => {
        const opClass = operatorClass(train.operator)
        const isBest = train.id === bestId
        const requiresChange = train.from === 'PAD' && train.operator === 'GWR'
        const statusCls =
          train.status === 'on_time' ? 'status-ontime' :
          train.status === 'delayed' ? 'status-delayed' : 'status-cancelled'
        const arr = estimatedArrivalHHMM(train)

        return (
          <div key={`${train.id}-${train.from}`} className={`train-row ${isBest ? 'best' : ''}`}>
            <div className="train-depart">{formatTime(train.estimatedDeparture)}</div>
            <div>
              <div className="train-op-row">
                <span className={`op-badge ${opClass}`}>
                  {operatorLabel(train.operator)}
                </span>
                {requiresChange && (
                  <span className="change-badge">Change at PAD</span>
                )}
                {train.terminatesPaddington && (
                  <span className="term-badge">Terminates PAD</span>
                )}
              </div>
              <div className="train-route">
                {train.from} → {train.to}
                {train.durationMinutes != null ? ` · ${train.durationMinutes}m` : ''}
                {train.isFast ? ' · Fast' : ''}
              </div>
              <div className="train-arr">
                arr {arr ?? '--:--'}
                {train.platform ? ` · Plat ${train.platform}` : ''}
              </div>
            </div>
            <div />
            <div className="train-status-wrap">
              <span className={`train-status ${statusCls}`}>{statusLabel(train)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
