import type { DeparturesResponse, StationCode } from './stations'
import { MOCK_TRAINS } from './mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://7wv7k35ssb.execute-api.eu-west-2.amazonaws.com/departures'

export async function fetchDepartures(
  from: StationCode,
  to: StationCode,
  signal?: AbortSignal
): Promise<DeparturesResponse> {
  if (USE_MOCK) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
    const key = `${from}-${to}`
    return {
      trains: MOCK_TRAINS[key] ?? [],
      fetchedAt: new Date().toISOString(),
    }
  }

  const url = `${API_BASE}?from=${from}&to=${to}`
  const res = await fetch(url, { signal })

  if (!res.ok) {
    throw new Error(`API error ${res.status}`)
  }

  return res.json() as Promise<DeparturesResponse>
}
