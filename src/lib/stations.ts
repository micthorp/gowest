export const STATIONS = {
  ZFD: { code: 'ZFD', name: 'Farringdon' },
  PAD: { code: 'PAD', name: 'London Paddington' },
  MAI: { code: 'MAI', name: 'Maidenhead' },
  RDG: { code: 'RDG', name: 'Reading' },
} as const

export type StationCode = keyof typeof STATIONS
export type Direction = 'homebound' | 'london'
export type Destination = 'MAI' | 'RDG'

export type TrainStatus = 'on_time' | 'delayed' | 'cancelled' | 'unknown'
export type OperatorCode = 'GWR' | 'Elizabeth' | 'Other'

export type DecisionLabel =
  | 'Take this'
  | 'Worth changing at Paddington'
  | 'Stay on Elizabeth line'
  | 'Avoid: terminates Paddington'
  | 'Disrupted'
  | 'No useful fast option'
  | 'First moving train wins'
  | 'Check Paddington departures'

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
}
