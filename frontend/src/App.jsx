import { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
} from "chart.js";
import { ping, fetchSchedule, fetchDrivers, fetchTelemetry } from "./api";
import Header from "./components/Header";
import Cover from "./components/Cover";
import SessionPicker from "./components/SessionPicker";
import ChannelChart from "./components/ChannelChart";

// Chart.js is modular — register only the pieces we use.
ChartJS.register(LineElement, PointElement, LinearScale, Tooltip);

const DEFAULT_YEAR = 2024;

function App() {
  // Landing -> app transition: "cover" shows the landing page, "exiting"
  // plays the slide-up animation with the app already rendered behind it,
  // "app" unmounts the cover entirely.
  const [stage, setStage] = useState("cover");

  function enterApp() {
    setStage("exiting");
    setTimeout(() => setStage("app"), 700); // matches the CSS transition
  }

  // Selection chain: year -> events (races) -> drivers. Each level's options
  // are fetched when the level above changes.
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [events, setEvents] = useState([]);
  const [round, setRound] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driver, setDriver] = useState("");
  const [driversLoading, setDriversLoading] = useState(false);

  // Telemetry + request lifecycle
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false); // fetch >4s -> probably a cold start
  const [apiStatus, setApiStatus] = useState("waking");

  // Remember which driver the loaded telemetry belongs to (for color/name),
  // separate from the dropdown which the user may change afterwards.
  const [loadedDriver, setLoadedDriver] = useState(null);

  // Ping once on mount so the header dot reflects backend state.
  useEffect(() => {
    ping()
      .then(() => setApiStatus("live"))
      .catch(() => setApiStatus("down"));
  }, []);

  // Year changed -> reload race list, keep first race selected.
  useEffect(() => {
    setEventsLoading(true);
    setEvents([]);
    setRound(null);
    fetchSchedule(year)
      .then((d) => {
        setEvents(d.events);
        setRound(d.events[0]?.round ?? null);
        setApiStatus("live");
      })
      .catch(() => setError("Couldn't load the race calendar."))
      .finally(() => setEventsLoading(false));
  }, [year]);

  // Race changed -> reload driver list. Keep the same driver selected if
  // they took part in the newly chosen race (nice when comparing races).
  useEffect(() => {
    if (round == null) return;
    setDriversLoading(true);
    setDrivers([]);
    fetchDrivers(year, round)
      .then((d) => {
        setDrivers(d.drivers);
        setDriver((prev) =>
          d.drivers.some((x) => x.code === prev) ? prev : d.drivers[0]?.code ?? ""
        );
      })
      .catch(() => setError("Couldn't load drivers for that race."))
      .finally(() => setDriversLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const slowTimer = useRef(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setSlow(false);
    // If the response takes >4s, assume Render is cold-starting and say so.
    slowTimer.current = setTimeout(() => setSlow(true), 4000);
    try {
      const data = await fetchTelemetry(year, round, driver);
      setTelemetry(data);
      setLoadedDriver(drivers.find((d) => d.code === driver) ?? null);
      setApiStatus("live");
    } catch (err) {
      // "Failed to fetch" here usually means the free-tier proxy dropped the
      // connection while the server was still downloading the session data.
      // The server finishes caching it anyway, so a retry succeeds quickly.
      setError(
        err.message === "Failed to fetch"
          ? "The server is still preparing this session — first load of a new race takes a while. Try again in ~30 seconds."
          : `Telemetry request failed: ${err.message}`
      );
    } finally {
      clearTimeout(slowTimer.current);
      setSlow(false);
      setLoading(false);
    }
  }

  // ---- shape telemetry into chart series ----
  const toPoints = (getY) =>
    telemetry.telemetry.map((p) => ({ x: p.Distance, y: getY(p) }));

  const lapLength =
    telemetry && telemetry.telemetry[telemetry.telemetry.length - 1].Distance;

  const color = loadedDriver?.color ?? "#3b82f6";

  const channels = telemetry && [
    { title: "Speed (km/h)", points: toPoints((p) => p.Speed), height: 220 },
    { title: "Throttle (%)", points: toPoints((p) => p.Throttle), height: 110 },
    { title: "Brake", points: toPoints((p) => Number(p.Brake)), height: 90, stepped: true },
    { title: "Gear", points: toPoints((p) => p.nGear), height: 110, stepped: true, showX: true },
  ];

  const topSpeed = telemetry && Math.max(...telemetry.telemetry.map((p) => p.Speed));
  const eventName = events.find((e) => e.round === round)?.name;

  // The cover overlays the app (position: fixed) and slides away on exit.
  // The app stays mounted underneath the whole time, so nothing remounts
  // or refetches when the cover leaves.
  return (
    <>
      {stage !== "app" && (
        <Cover exiting={stage === "exiting"} onEnter={enterApp} apiStatus={apiStatus} />
      )}
    <div className="app">
      <Header apiStatus={apiStatus} />

      <SessionPicker
        year={year} onYear={setYear}
        events={events} round={round} onRound={setRound} eventsLoading={eventsLoading}
        drivers={drivers} driver={driver} onDriver={setDriver} driversLoading={driversLoading}
        onAnalyze={analyze} analyzing={loading}
      />

      {slow && (
        <div className="notice">
          Free-tier server is waking from sleep — the first request can take up to
          a minute. Data is cached after that.
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      {loading && !telemetry && (
        <div>
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 90 }} />
        </div>
      )}

      {telemetry && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">
                <span className="swatch" style={{ background: color }} />
                {loadedDriver?.name ?? telemetry.driver}
              </div>
              <div className="sub">{loadedDriver?.team}</div>
            </div>
            <div className="card">
              <div className="label">Fastest lap</div>
              <div className="value">{telemetry.lap_time}</div>
            </div>
            <div className="card">
              <div className="label">Top speed</div>
              <div className="value">{Math.round(topSpeed)} km/h</div>
            </div>
          </div>

          <div className="charts">
            <h2>{eventName} — qualifying telemetry</h2>
            {channels.map((ch) => (
              <ChannelChart key={ch.title} xMax={lapLength} color={color} {...ch} />
            ))}
          </div>
        </>
      )}

      {!telemetry && !loading && (
        <div className="empty">
          Pick a season, race, and driver — then analyze their fastest qualifying lap.
        </div>
      )}
    </div>
    </>
  );
}

export default App;
