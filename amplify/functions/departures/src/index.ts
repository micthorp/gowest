/**
 * GoWest — Amplify Lambda function
 * Proxies requests to the RTT NG API.
 * Token never leaves this function; never exposed to the browser.
 *
 * Endpoint: GET /.amplify/functions/departures?from=ZFD&to=MAI
 */

const ALLOWED_STATIONS = new Set(['ZFD', 'PAD', 'MAI', 'RDG'])
const RTT_BASE = 'https://data.rtt.io'

// ATOC codes for operators we care about
const OPERATOR_MAP: Record<string, string> = {
  GW: 'GWR',
  XR: 'Elizabeth',
  TL: 'Elizabeth', // Thameslink occasionally appears
}

interface RTTService {
  serviceUid: string
  atocCode: string
  atocName: string
  locationDetail: {
    gbttBookedDeparture: string
    realtimeDeparture?: string
    realtimeDepartureActual?: boolean
    gbttBookedArrival?: string
    realtimeArrival?: string
    platform?: string
    platformConfirmed?: boolean
    displayAs?: string
    origin: Array<{ description: string; publicTime: string }>
    destination: Array<{ description: string; publicTime: string }>
  }
  runDate: string
  locations?: Array<{ crs?: string; description: string }>
}

interface RTTResponse {
  services?: RTTService[]
  location?: { name: string; crs: string }
}

function formatHHMM(raw: string | undefined): string {
  if (!raw) return ''
  // RTT NG returns ISO-8601; old API returned HHMM — handle both
  if (raw.includes('T')) {
    const d = new Date(raw)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  }
  if (raw.length === 4) return `${raw.slice(0, 2)}:${raw.slice(2)}`
  return raw
}

function parseDuration(dep: string, arr: string | undefined): number | undefined {
  if (!arr || !dep) return undefined
  try {
    const [dh, dm] = dep.split(':').map(Number)
    const [ah, am] = arr.split(':').map(Number)
    const diff = (ah * 60 + am) - (dh * 60 + dm)
    return diff > 0 ? diff : undefined
  } catch { return undefined }
}

function deriveStatus(scheduledDep: string, estimatedDep: string | undefined) {
  if (!estimatedDep || estimatedDep === scheduledDep) {
    return { status: 'on_time' as const, delayMinutes: 0 }
  }
  try {
    const [sh, sm] = scheduledDep.split(':').map(Number)
    const [eh, em] = estimatedDep.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff > 0) return { status: 'delayed' as const, delayMinutes: diff }
  } catch { /* fall through */ }
  return { status: 'on_time' as const, delayMinutes: 0 }
}

function isFastService(service: RTTService, from: string, to: string): boolean {
  const locs = service.locations ?? []
  // Fast if ≤ 3 intermediate stops between our from and to
  const fromIdx = locs.findIndex(l => l.crs === from)
  const toIdx = locs.findIndex(l => l.crs === to)
  if (fromIdx === -1 || toIdx === -1) return true // unknown, assume fast
  return (toIdx - fromIdx) <= 3
}

function terminatesPaddington(service: RTTService, to: string): boolean {
  if (to === 'PAD') return false
  const dest = service.locationDetail.destination
  return dest.some(d => d.description.toLowerCase().includes('paddington'))
}

export const handler = async (event: {
  queryStringParameters?: Record<string, string>
  httpMethod?: string
}) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { from, to } = event.queryStringParameters ?? {}

  if (!from || !to || !ALLOWED_STATIONS.has(from) || !ALLOWED_STATIONS.has(to) || from === to) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid station codes' }),
    }
  }

  const token = process.env.RTT_API_TOKEN
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API token not configured' }) }
  }

  try {
    // RTT NG departures endpoint: /api/v1/gb/station/{crs}/departures/to/{dest}
    const rttUrl = `${RTT_BASE}/api/v1/gb/station/${from}/departures/to/${to}`

    const rttRes = await fetch(rttUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!rttRes.ok) {
      const text = await rttRes.text()
      console.error('RTT error', rttRes.status, text)
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `RTT API error: ${rttRes.status}` }),
      }
    }

    const rttData: RTTResponse = await rttRes.json()
    const services = rttData.services ?? []

    const trains = services
      .filter(s => s.locationDetail.displayAs !== 'CANCELLED_CALL')
      .slice(0, 8)
      .map(s => {
        const ld = s.locationDetail
        const scheduledDep = formatHHMM(ld.gbttBookedDeparture)
        const estimatedDep = formatHHMM(ld.realtimeDeparture) || scheduledDep
        const scheduledArr = formatHHMM(ld.gbttBookedArrival)
        const estimatedArr = formatHHMM(ld.realtimeArrival) || scheduledArr
        const { status, delayMinutes } = deriveStatus(scheduledDep, estimatedDep)
        const operator = OPERATOR_MAP[s.atocCode] ?? 'Other'

        return {
          id: `${s.serviceUid}-${s.runDate}`,
          operator,
          from,
          to,
          scheduledDeparture: scheduledDep,
          estimatedDeparture: estimatedDep,
          scheduledArrival: scheduledArr,
          estimatedArrival: estimatedArr,
          durationMinutes: parseDuration(estimatedDep, estimatedArr),
          platform: ld.platform ?? undefined,
          status: s.locationDetail.displayAs === 'CANCELLED_CALL' ? 'cancelled' : status,
          delayMinutes,
          destinationName: ld.destination[0]?.description,
          isFast: isFastService(s, from, to),
          terminatesPaddington: terminatesPaddington(s, to),
        }
      })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ trains, fetchedAt: new Date().toISOString() }),
    }
  } catch (err) {
    console.error('Function error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error' }),
    }
  }
}
