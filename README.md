
# PitWall

A Formula 1 telemetry visualization app. It pulls real lap data from official F1 timing (via FastF1) and charts a driver's fastest lap — speed, throttle, brake, and gear plotted against distance around the track. A race-winner prediction feature is in progress.

Backend is live at https://pitwall-9t5c.onrender.com

## Stack

- **Backend:** FastAPI, FastF1, pandas — serves lap telemetry as JSON. Deployed on Render.
- **Frontend:** React (Vite) + Chart.js — fetches the telemetry and renders it.

The frontend and backend are separate and talk over HTTP, so CORS is enabled on the API.

## Status

Working: backend deployed, `/telemetry` endpoint returning real lap data, React frontend charting it, session/driver selection.

In progress: two-driver comparison, speed-colored track map from X/Y position data, delta-time trace, extra channels (DRS/RPM).

Planned: ML race-winner prediction, landing page, public frontend deployment.

## Running locally

Needs Python 3.12+ and Node 20+.

Backend, from the project root:

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1        # Windows; use `source venv/bin/activate` on Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at `http://localhost:8000`. Test it:

```
http://localhost:8000/telemetry?year=2024&round=1&driver=VER
```

First request for a session is slow (10-30s) while FastF1 downloads and caches it. After that it's fast.

Frontend, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Endpoint

`GET /telemetry?year=2024&round=1&driver=VER`

Returns the driver's fastest lap in that session — lap time plus a list of telemetry points (distance, speed, throttle, brake, gear).

## Notes

Backend is on Render's free tier, which sleeps after ~15 min idle. First request after a sleep takes up to ~50s to wake the server.
