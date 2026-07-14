# PitWall

**Live: [pitwall-frontend.onrender.com](https://pitwall-frontend.onrender.com)**

A Formula 1 telemetry analysis app. Pick any session since 2019 — practice, qualifying, sprint, or race — and compare two drivers' fastest laps corner by corner: speed, throttle, brake, and gear traces, a delta-time graph showing exactly where time is won and lost, and a track map drawn from the car's real X/Y position data, colored by speed.

Data comes from official F1 live timing via [FastF1](https://github.com/theOehrly/Fast-F1).

## Features

- **Two-driver comparison** — overlaid telemetry traces in team colors, with an instant A⇄B baseline swap (no refetch; the loaded data is just reordered)
- **Delta-time trace** — driver B's elapsed time interpolated at driver A's distance samples; positive means losing time
- **Speed-colored track map** — the racing line rendered from position telemetry, one SVG segment per sample, with a start/finish marker and a position dot that follows your cursor
- **Synced crosshair** — hover any chart and a crosshair tracks the same distance across all five, plus the map dot, without a single React re-render (Chart.js plugin + direct canvas repaints)
- **Timing-tower results table** — classification order, FIA-style purple for the fastest lap, gap column
- **Every session type** — FP1/FP2/FP3, Sprint Qualifying, Sprint, Qualifying, Race, per-weekend (sprint weekends expose their extra sessions automatically)
- **Start-light launch** — the landing page runs a real five-light start sequence in pure CSS

## Architecture

```
Browser ──► Render Static Site (CDN)      React + Vite + Chart.js
   │
   └──────► Render Web Service (512MB)    FastAPI + FastF1 + pandas
                   │
                   └── F1 live-timing API (cached to disk + memory)
```

Frontend and backend are separate services from one repo, talking over HTTP with CORS. Every push to `main` deploys both: the static site rebuilds on Render's CDN (defined in [render.yaml](render.yaml)) and the API redeploys.

### Free-tier engineering

The API runs on a 512MB instance, and one FastF1 session load peaks at 400–500MB. Making that workable is most of the backend's design:

- A `threading.Lock` serializes session loads — two concurrent loads would OOM the instance
- `gc.collect()` + `malloc_trim` after each telemetry response hand freed memory back to the OS immediately
- `/schedule` and `/drivers` responses are cached in memory (a past session's classification never changes); telemetry relies on FastF1's disk cache instead — at ~1MB per response it's too big to keep in RAM
- A GitHub Actions cron pings the API every 10 minutes so the instance never sleeps (cold starts were ~50s)
- The frontend retries once automatically when a first-ever session load outlives the proxy's ~100s window — the server finishes caching regardless, so the retry succeeds

## API

| Endpoint | Returns |
|---|---|
| `GET /schedule?year=2024` | Season calendar with each weekend's session list |
| `GET /drivers?year=2024&round=1&session=Q` | Classification-ordered driver list with team colors |
| `GET /telemetry?year=2024&round=1&driver=VER&session=Q` | Fastest-lap telemetry: distance, speed, throttle, brake, gear, X/Y, time |

Interactive docs at [`/docs`](https://pitwall-9t5c.onrender.com/docs).

## Running locally

Needs Python 3.12+ and Node 20+.

```bash
# backend, from the repo root
python -m venv venv
.\venv\Scripts\Activate.ps1        # Windows; source venv/bin/activate elsewhere
pip install -r requirements.txt
uvicorn main:app --reload          # http://localhost:8000

# frontend, in another terminal
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000 > .env.local
npm run dev                        # http://localhost:5173
```

The first request for any session is slow (10–60s) while FastF1 downloads and caches it; after that it's fast.

## Roadmap

ML race-winner prediction tab — the header already reserves the spot.
