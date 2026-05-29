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
      <div className="toggle-group">
        <button
          className={`toggle-btn ${direction === 'homebound' ? 'active' : ''}`}
          onClick={() => onDirectionChange('homebound')}
        >
          Homebound
        </button>
        <button
          className={`toggle-btn ${direction === 'london' ? 'active' : ''}`}
          onClick={() => onDirectionChange('london')}
        >
          London
        </button>
      </div>
      <div className="toggle-group">
        <button
          className={`toggle-btn ${destination === 'MAI' ? 'active' : ''}`}
          onClick={() => onDestinationChange('MAI')}
        >
          Maidenhead
        </button>
        <button
          className={`toggle-btn ${destination === 'RDG' ? 'active' : ''}`}
          onClick={() => onDestinationChange('RDG')}
        >
          Reading
        </button>
      </div>
    </div>
  )
}
