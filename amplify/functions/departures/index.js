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

function londonISO(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

function extractServices(rttData) {
  if (Array.isArray(rttData?.services)) return rttData.services
  if (Array.isArray(rttData?.location?.services)) return rttData.location.services
  return []
}

async function fetchServices(accessToken, from, to) {
  const timeFrom = londonISO(new Date())
  const timeTo = londonISO(new Date(Date.now() + 120 * 60_000))
  const url = new URL(`${RTT_BASE}/gb-nr/location`)
  url.searchParams.set('code', from)
  url.searchParams.set('filterTo', to)
  url.searchParams.set('timeFrom', timeFrom)
  url.searchParams.set('timeTo', timeTo)

  const rttRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (rttRes.status === 204) {
    return { trains: [], rttDebug: { status: 204, from, to, timeFrom, timeTo } }
  }

  if (!rttRes.ok) {
    const text = await rttRes.text()
    console.error('RTT error', rttRes.status, text)
    throw new Error(`RTT API error: ${rttRes.status}`)
  }

  const rttData = await rttRes.json()
  const services = extractServices(rttData)
  const rttDebug = {
    status: rttRes.status,
    from,
    to,
    timeFrom,
    timeTo,
    serviceCount: services.length,
    keys: rttData && typeof rttData === 'object' ? Object.keys(rttData) : [],
    query: rttData?.query ?? null,
  }
  console.log('RTT location', JSON.stringify(rttDebug))

  const trains = services.slice(0, 8).map((s) => {
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
  return { trains, rttDebug }
}

export async function handler(event) {
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
    let rttDebug
    if (from === 'ZFD') {
      const [zfd, pad] = await Promise.all([
        fetchServices(accessToken, 'ZFD', to),
        fetchServices(accessToken, 'PAD', to),
      ])
      trains = [...zfd.trains, ...pad.trains].sort((a, b) => {
        const [ah, am] = a.estimatedDeparture.split(':').map(Number)
        const [bh, bm] = b.estimatedDeparture.split(':').map(Number)
        return (ah * 60 + am) - (bh * 60 + bm)
      })
      rttDebug = { zfd: zfd.rttDebug, pad: pad.rttDebug }
    } else {
      const result = await fetchServices(accessToken, from, to)
      trains = result.trains
      rttDebug = result.rttDebug
    }

    const body = { trains, fetchedAt: new Date().toISOString() }
    if (trains.length === 0) body.rttDebug = rttDebug

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(body),
    }
  } catch (err) {
    console.error('Handler error', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
