import type { Direction, Destination } from '../lib/stations'

interface Props {
  direction: Direction
  destination: Destination
  onDirectionChange: (d: Direction) => void
  onDestinationChange: (d: Destination) => void
}

export function Controls({ direction, destination, onDirectionChange, onDestinationChange }: Props) {
  return (
    <div className="controls-bar">
      <div className="toggle-group" role="group" aria-label="Direction">
        <button
          type="button"
          className={`toggle-btn ${direction === 'homebound' ? 'active' : ''}`}
          aria-pressed={direction === 'homebound'}
          onClick={() => onDirectionChange('homebound')}
        >
          Homebound
        </button>
        <button
          type="button"
          className={`toggle-btn ${direction === 'london' ? 'active' : ''}`}
          aria-pressed={direction === 'london'}
          onClick={() => onDirectionChange('london')}
        >
          London
        </button>
      </div>
      <div className="toggle-group" role="group" aria-label="Station">
        <button
          type="button"
          className={`toggle-btn ${destination === 'MAI' ? 'active' : ''}`}
          aria-pressed={destination === 'MAI'}
          onClick={() => onDestinationChange('MAI')}
        >
          Maidenhead
        </button>
        <button
          type="button"
          className={`toggle-btn ${destination === 'RDG' ? 'active' : ''}`}
          aria-pressed={destination === 'RDG'}
          onClick={() => onDestinationChange('RDG')}
        >
          Reading
        </button>
      </div>
    </div>
  )
}
