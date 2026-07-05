from fastapi import FastAPI, HTTPException
import gc
import os
import threading
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


# FastAPI runs sync endpoints in a thread pool, so concurrent requests can
# each start a full FastF1 session download — enough to exhaust the free
# tier's 512MB and 502 the whole service. Serializing loads means the first
# request does the work and the rest hit the warm cache.
_load_lock = threading.Lock()

# FastF1 session identifiers we expose. Anything else in the query -> 422
# instead of arbitrary strings reaching fastf1.get_session.
VALID_SESSIONS = {"FP1", "FP2", "FP3", "Q", "SQ", "S", "R"}

# Schedule lists sessions by display name; the other endpoints take codes.
SESSION_CODES = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SQ",  # 2023 naming for the same thing
    "Sprint": "S",
    "Race": "R",
}


def load_session(year: int, round: int, session: str, telemetry: bool):
    with _load_lock:
        s = fastf1.get_session(year, round, session)
        s.load(telemetry=telemetry, weather=False, messages=False)
        return s


def check_session_code(session: str) -> str:
    code = session.upper()
    if code not in VALID_SESSIONS:
        raise HTTPException(status_code=422, detail=f"Unknown session '{session}'")
    return code


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
                # which sessions this weekend ran (sprint weekends differ) —
                # Session1..Session5 are display names in the schedule table
                "sessions": [
                    {"code": SESSION_CODES[name], "name": name}
                    for name in (row[f"Session{i}"] for i in range(1, 6))
                    if name in SESSION_CODES
                ],
            }
            for _, row in past.iterrows()
        ],
    }


@app.get("/drivers")
def get_drivers(year: int, round: int, session: str = "Q"):
    # Who took part in this session -> feeds the driver picker, in
    # classification order. TeamColor gives each driver their real team
    # color for the charts.
    code = check_session_code(session)
    try:
        session_obj = load_session(year, round, code, telemetry=False)
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
            for _, row in session_obj.results.iterrows()
        ]
    }


@app.get("/telemetry")
def get_telemetry(year: int, round: int, driver: str, session: str = "Q"):
    code = check_session_code(session)
    try:
        session_obj = load_session(year, round, code, telemetry=True)
        lap = session_obj.laps.pick_drivers(driver).pick_fastest()
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
    result = {
        "driver": driver,
        "session": code,
        "lap_time": format_lap_time(lap["LapTime"]),
        "telemetry": data.to_dict(orient="records"),
    }
    # A full session is hundreds of MB of DataFrames; on a 512MB instance we
    # want that memory back the moment the response is built, not whenever
    # Python gets around to it.
    del session_obj, lap, tel, data
    gc.collect()
    return result


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
