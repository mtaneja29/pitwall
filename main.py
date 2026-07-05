from fastapi import FastAPI
import os
import uvicorn
import pandas  as pd
import fastf1
from fastapi.middleware.cors import CORSMiddleware

app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def  home():
    return{"message":"Hello F1"}

@app.get("/telemetry")
def get_telemetry(year:int,round:int,driver:str):
    session=fastf1.get_session(year,round,"Q")
    session.load(telemetry=True,weather=False,messages=False)
    lap=session.laps.pick_drivers(driver).pick_fastest()
    tel=lap.get_telemetry()
    data=tel[["Distance","Speed","Throttle","Brake","nGear"]].dropna()
    return{
        "driver":driver,
        "lap_time": str(lap["LapTime"]),
        "telemetry":data.to_dict(orient="records")
    }

if __name__  == "__main__":
    port=int(os.environ.get("PORT",8000))
    uvicorn.run("main:app",host="0.0.0.0",port=port)
