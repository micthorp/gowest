import type { DeparturesResponse, StationCode } from './stations'
import { MOCK_TRAINS } from './mockData'

const USE_MOCK = (import.meta as unknown as { env: Record<string, string> }).env.VITE_USE_MOCK === 'true'
const API_BASE = '/.amplify/functions/departures'

export async function fetchDepartures(
  from: StationCode,
  to: StationCode
): Promise<DeparturesResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400))
    const key = `${from}-${to}`
    return {
      trains: MOCK_TRAINS[key] ?? [],
      fetchedAt: new Date().toISOString(),
    }
  }

  const url = `${API_BASE}?from=${from}&to=${to}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`API error ${res.status}`)
  }

  return res.json() as Promise<DeparturesResponse>
}
