from fastapi import FastAPI, HTTPException
import os
import uvicorn
import pandas as pd
import fastf1
from fastapi.middleware.cors import CORSMiddleware

# Cache FastF1 downloads on disk so repeat requests for the same session
# are near-instant. On Render's free tier the disk is wiped on each
# restart, so this only helps while the instance stays awake.
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "f1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def format_lap_time(td) -> str:
    # pandas Timedelta -> "1:29.179" instead of "0 days 00:01:29.179000"
    total = td.total_seconds()
    return f"{int(total // 60)}:{total % 60:06.3f}"


@app.get("/")
def home():
    return {"message": "Hello F1"}


@app.get("/schedule")
def get_schedule(year: int):
    # Race calendar for the season -> feeds the Grand Prix dropdown.
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    # Only events whose qualifying has already happened have telemetry.
    past = schedule[schedule["EventDate"] < pd.Timestamp.now()]
    return {
        "year": year,
        "events": [
            {
                "round": int(row["RoundNumber"]),
                "name": row["EventName"],
                "country": row["Country"],
                "date": str(row["EventDate"].date()),
            }
            for _, row in past.iterrows()
        ],
    }


@app.get("/drivers")
def get_drivers(year: int, round: int):
    # Who took part in this qualifying -> feeds the driver dropdowns.
    # TeamColor gives each driver their real team color for the charts.
    try:
        session = fastf1.get_session(year, round, "Q")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found or not loadable")
    return {
        "drivers": [
            {
                "code": row["Abbreviation"],
                "name": row["FullName"],
                "team": row["TeamName"],
                "color": f"#{row['TeamColor']}" if row["TeamColor"] else "#888888",
            }
            for _, row in session.results.iterrows()
        ]
    }


@app.get("/telemetry")
def get_telemetry(year: int, round: int, driver: str):
    try:
        session = fastf1.get_session(year, round, "Q")
        session.load(telemetry=True, weather=False, messages=False)
        lap = session.laps.pick_drivers(driver).pick_fastest()
        if lap is None:
            raise HTTPException(status_code=404, detail=f"No lap found for {driver}")
        tel = lap.get_telemetry()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found or not loadable")

    # X/Y = car position on track (for the track map).
    # Time = seconds since lap start (for the delta-time comparison).
    tel = tel.copy()
    tel["Time"] = tel["Time"].dt.total_seconds()
    data = tel[["Distance", "Speed", "Throttle", "Brake", "nGear", "X", "Y", "Time"]].dropna()
    data = data.round({"Distance": 1, "Speed": 1, "X": 0, "Y": 0, "Time": 3})
    return {
        "driver": driver,
        "lap_time": format_lap_time(lap["LapTime"]),
        "telemetry": data.to_dict(orient="records"),
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
