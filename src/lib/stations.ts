export const STATIONS = {
  ZFD: { code: 'ZFD', name: 'Farringdon' },
  PAD: { code: 'PAD', name: 'London Paddington' },
  MAI: { code: 'MAI', name: 'Maidenhead' },
  RDG: { code: 'RDG', name: 'Reading' },
  MYB: { code: 'MYB', name: 'London Marylebone' },
  BCF: { code: 'BCF', name: 'Beaconsfield' },
} as const

export type StationCode = keyof typeof STATIONS
export type Direction = 'homebound' | 'london'
export type Destination = 'MAI' | 'RDG' | 'BCF'

export type TrainStatus = 'on_time' | 'delayed' | 'cancelled' | 'unknown'
export type OperatorCode = 'GWR' | 'Elizabeth' | 'Chiltern' | 'Other'

export type DecisionLabel =
  | 'Take this'
  | 'Worth changing at Paddington'
  | 'Stay on Elizabeth line'
  | 'Avoid: terminates Paddington'
  | 'Disrupted'
  | 'No useful fast option'
  | 'First moving train wins'
  | 'Check Paddington departures'
  | 'Use Chiltern via Marylebone'

export interface TrainOption {
  id: string
  operator: OperatorCode
  from: StationCode
  to: StationCode
  scheduledDeparture: string
  estimatedDeparture: string
  scheduledArrival?: string
  estimatedArrival?: string
  durationMinutes?: number
  platform?: string
  status: TrainStatus
  delayMinutes?: number
  destinationName?: string
  callingPoints?: string[]
  isFast?: boolean
  terminatesPaddington?: boolean
}

export interface DeparturesResponse {
  trains: TrainOption[]
  fetchedAt: string
  error?: string
  /** Delay/cancellation reason text from RTT, if any. */
  alerts?: string[]
}

export function isChilternDestination(destination: Destination): boolean {
  return destination === 'BCF'
}

export function routeFor(
  direction: Direction,
  destination: Destination
): { from: StationCode; to: StationCode } {
  if (destination === 'BCF') {
    return direction === 'homebound'
      ? { from: 'MYB', to: 'BCF' }
      : { from: 'BCF', to: 'MYB' }
  }
  if (direction === 'homebound') return { from: 'ZFD', to: destination }
  return { from: destination, to: 'PAD' }
}

export function chilternBackupRoute(direction: Direction): { from: StationCode; to: StationCode } {
  return direction === 'homebound'
    ? { from: 'MYB', to: 'BCF' }
    : { from: 'BCF', to: 'MYB' }
}
