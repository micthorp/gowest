'use strict'

const ALLOWED_STATIONS = new Set(['ZFD', 'PAD', 'MAI', 'RDG', 'MYB', 'BEF'])
const RTT_BASE = 'https://data.rtt.io'

let cachedAccessToken = null
let cachedTokenExpiry = null

async function getAccessToken(refreshToken) {
  if (cachedAccessToken && cachedTokenExpiry && Date.now() < cachedTokenExpiry - 60_000) {
    return cachedAccessToken
  }
  const res = await fetch(`${RTT_BASE}/api/get_access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json()
  if (!data?.token) throw new Error('Token exchange returned no token')
  cachedAccessToken = data.token
  cachedTokenExpiry = data.validUntil ? new Date(data.validUntil).getTime() : Date.now() + 50 * 60_000
  return cachedAccessToken
}

function typicalDuration(operator, from, to) {
  if ((from === 'MYB' && to === 'BEF') || (from === 'BEF' && to === 'MYB')) return 27
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

function toHHMM(isoString) {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    })
  } catch {
    return ''
  }
}

function delayMins(scheduled, actual) {
  if (!scheduled || !actual) return 0
  try {
    const diff = Math.round((new Date(actual).getTime() - new Date(scheduled).getTime()) / 60000)
    return diff > 0 ? diff : 0
  } catch {
    return 0
  }
}

function nowLondonISO() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T')
}

async function fetchServices(accessToken, from, to) {
  const url = new URL(`${RTT_BASE}/gb-nr/location`)
  url.searchParams.set('code', from)
  url.searchParams.set('filterTo', to)
  url.searchParams.set('timeWindow', '120')
  url.searchParams.set('timeFrom', nowLondonISO())

  const rttRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!rttRes.ok) {
    const text = await rttRes.text()
    console.error('RTT error', rttRes.status, text)
    throw new Error(`RTT API error: ${rttRes.status}`)
  }

  const rttData = await rttRes.json()
  const services = rttData.services ?? []

  return services.slice(0, 8).map((s) => {
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
      operator === 'CH' ? 'Chiltern' : 'Other'
    const isCancelled = dep?.isCancelled === true

    return {
      id: s.scheduleMetadata?.uniqueIdentity ?? Math.random().toString(),
      operator: operatorName,
      from,
      to,
      scheduledDeparture: schedDep,
      estimatedDeparture: estDep,
      durationMinutes: typicalDuration(operatorName, from, to),
      platform: plat?.actual ?? plat?.forecast ?? plat?.planned ?? undefined,
      status: isCancelled ? 'cancelled' : delay > 0 ? 'delayed' : 'on_time',
      delayMinutes: delay,
      destinationName: destLocation?.description,
      isFast: operatorName === 'GWR' || operatorName === 'Chiltern',
      terminatesPaddington: Array.isArray(destLocation?.shortCodes)
        ? destLocation.shortCodes.includes('PAD') && to !== 'PAD'
        : destLocation?.crs === 'PAD' && to !== 'PAD',
    }
  })
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'X-Content-Type-Options': 'nosniff',
  }

  const method = event.httpMethod || event.requestContext?.http?.method || 'GET'
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const params = event.queryStringParameters ?? {}
  const from = params.from
  const to = params.to

  if (!from || !to || !ALLOWED_STATIONS.has(from) || !ALLOWED_STATIONS.has(to) || from === to) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid station codes' }) }
  }

  const refreshToken = process.env.RTT_API_TOKEN
  if (!refreshToken) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API token not configured' }) }
  }

  try {
    const accessToken = await getAccessToken(refreshToken)

    let trains
    if (from === 'ZFD') {
      const [zfdTrains, padTrains] = await Promise.all([
        fetchServices(accessToken, 'ZFD', to),
        fetchServices(accessToken, 'PAD', to),
      ])
      trains = [...zfdTrains, ...padTrains].sort((a, b) => {
        const [ah, am] = a.estimatedDeparture.split(':').map(Number)
        const [bh, bm] = b.estimatedDeparture.split(':').map(Number)
        return (ah * 60 + am) - (bh * 60 + bm)
      })
    } else {
      trains = await fetchServices(accessToken, from, to)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ trains, fetchedAt: new Date().toISOString() }),
    }
  } catch (err) {
    console.error('Handler error', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
