const ALLOWED_STATIONS = new Set(['ZFD', 'PAD', 'MAI', 'RDG'])
const RTT_BASE = 'https://data.rtt.io'

let cachedAccessToken: string | null = null
let cachedTokenExpiry: number | null = null

async function getAccessToken(refreshToken: string): Promise<string> {
  if (cachedAccessToken && cachedTokenExpiry && Date.now() < cachedTokenExpiry - 60_000) {
    return cachedAccessToken
  }
  const res = await fetch(`${RTT_BASE}/api/get_access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json() as { token: string; validUntil: string }
  cachedAccessToken = data.token
  cachedTokenExpiry = new Date(data.validUntil).getTime()
  return cachedAccessToken
}

function typicalDuration(operator: string, from: string, to: string): number | undefined {
  if (from === 'PAD' || from === 'ZFD') {
    if (to === 'MAI') return operator === 'GWR' ? 23 : 47
    if (to === 'RDG') return operator === 'GWR' ? 32 : 65
  }
  if (to === 'PAD') {
    if (from === 'MAI') return operator === 'GWR' ? 23 : 47
    if (from === 'RDG') return operator === 'GWR' ? 32 : 65
  }
  return undefined
}

function toHHMM(isoString: string | undefined): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  } catch { return '' }
}

function delayMins(scheduled: string | undefined, actual: string | undefined): number {
  if (!scheduled || !actual) return 0
  try {
    const diff = Math.round((new Date(actual).getTime() - new Date(scheduled).getTime()) / 60000)
    return diff > 0 ? diff : 0
  } catch { return 0 }
}

export const handler = async (event: {
  httpMethod?: string
  queryStringParameters?: Record<string, string>
}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'X-Content-Type-Options': 'nosniff',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const params = event.queryStringParameters ?? {}
  const { from, to } = params

  if (!from || !to || !ALLOWED_STATIONS.has(from) || !ALLOWED_STATIONS.has(to) || from === to) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid station codes' }) }
  }

  const refreshToken = process.env.RTT_API_TOKEN
  if (!refreshToken) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API token not configured' }) }
  }

  try {
    const accessToken = await getAccessToken(refreshToken)

    const url = new URL(`${RTT_BASE}/gb-nr/location`)
    url.searchParams.set('code', from)
    url.searchParams.set('filterTo', to)
    url.searchParams.set('timeWindow', '120')

    const rttRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })

    if (!rttRes.ok) {
      const text = await rttRes.text()
      console.error('RTT error', rttRes.status, text)
      return { statusCode: 502, headers, body: JSON.stringify({ error: `RTT API error: ${rttRes.status}` }) }
    }

    const rttData = await rttRes.json() as { services?: Record<string, unknown>[] }
    const services = rttData.services ?? []

    const trains = services
      .filter((s: any) => s.temporalData?.departure?.isCancelled !== true)
      .slice(0, 8)
      .map((s: any) => {
        const dep = s.temporalData?.departure
        const plat = s.locationMetadata?.platform
        const sched = dep?.scheduleAdvertised
        const actual = dep?.realtimeEstimate ?? dep?.realtimeForecast ?? dep?.realtimeActual
        const schedDep = toHHMM(sched)
        const estDep = toHHMM(actual) || schedDep
        const delay = delayMins(sched, actual)
        const destLocation = s.destination?.[0]?.location
        const operator = s.scheduleMetadata?.operator?.code ?? 'Other'

        const operatorName =
          operator === 'GW' ? 'GWR' :
          operator === 'XR' ? 'Elizabeth' :
          operator === 'TL' ? 'Elizabeth' : 'Other'

        const isCancelled = dep?.isCancelled === true
        const status = isCancelled ? 'cancelled' : delay > 0 ? 'delayed' : 'on_time'

        return {
          id: s.scheduleMetadata?.uniqueIdentity ?? Math.random().toString(),
          operator: operatorName,
          from,
          to,
          scheduledDeparture: schedDep,
          estimatedDeparture: estDep,
          durationMinutes: typicalDuration(operatorName, from, to),
          platform: plat?.actual ?? plat?.forecast ?? plat?.planned ?? undefined,
          status,
          delayMinutes: delay,
          destinationName: destLocation?.description,
          isFast: true,
          terminatesPaddington: destLocation?.shortCodes?.includes('PAD') && to !== 'PAD',
        }
      })

    return {
      statusCode: 20