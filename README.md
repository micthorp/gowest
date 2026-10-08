# GoWest

> Fast westbound decisions, before the railway changes its mind.

A commuter dashboard for westbound decisions between Farringdon/Paddington and Maidenhead/Reading, with Chiltern (Marylebone ↔ Beaconsfield) as the backup when that corridor fails.

## Stack

- React + TypeScript + Vite (frontend)
- AWS Amplify Hosting (static site)
- AWS Lambda via Amplify Functions (RTT API proxy)
- Realtime Trains NG API (live rail data)

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` to run against mock data (`VITE_USE_MOCK=true`). No API calls made locally.

```bash
npm test
```

## Deployment (AWS Amplify)

1. Push this repo to GitHub
2. In AWS Amplify Console → New app → Host web app → connect GitHub repo
3. Amplify will detect `amplify.yml` and configure the build automatically
4. Add environment variable in Amplify Console:
   - Key: `RTT_API_TOKEN`
   - Value: your token from api-portal.rtt.io
5. Deploy

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `RTT_API_TOKEN` | Amplify Console (server-side only) | RTT NG API bearer token |
| `VITE_USE_MOCK` | `.env.local` (local dev only) | Use mock data instead of live API |

The RTT token is **never** exposed to the browser. It lives only in the Lambda function environment.

## Routes

| Direction | From | To |
|---|---|---|
| Homebound | ZFD (Farringdon) | MAI (Maidenhead) or RDG (Reading) |
| Homebound | PAD (Paddington) | MAI or RDG |
| Homebound | MYB (Marylebone) | BCF (Beaconsfield) — Chiltern backup |
| London-bound | MAI or RDG | PAD (Paddington) |
| London-bound | BCF (Beaconsfield) | MYB (Marylebone) — Chiltern backup |

## Decision logic

For homebound journeys (Farringdon → Maidenhead/Reading):

1. Take the next through Elizabeth as the baseline.
2. Only consider GWR from Paddington if it is **catchable**: next Elizabeth to Paddington (~12 min) plus an 8 minute interchange must land you on the platform before it leaves.
3. Recommend changing only if that catchable GWR still gets you there ≥8 minutes earlier.

On Maidenhead/Reading views, the next Chiltern services are always listed as a backup. If the Paddington corridor has nothing usable, the main recommendation switches to **Use Chiltern via Marylebone**.

If Elizabeth or GWR is wiped out (or missing from the feed, which is how RTT often represents mass cancellations), a red banner calls that out even when the other operator is still running.

Selecting **Beaconsfield** shows the Chiltern corridor on its own (Marylebone ↔ Beaconsfield).
