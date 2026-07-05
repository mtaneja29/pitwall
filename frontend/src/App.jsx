import { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
} from "chart.js";
import { ping, fetchSchedule, fetchDrivers, fetchTelemetry } from "./api";
import { crosshairSync } from "./crosshairSync";
import { computeDelta } from "./delta";
import Header from "./components/Header";
import Cover from "./components/Cover";
import SessionPicker from "./components/SessionPicker";
import ChannelChart from "./components/ChannelChart";
import TrackMap from "./components/TrackMap";

// Chart.js is modular — register only the pieces we use.
ChartJS.register(LineElement, PointElement, LinearScale, Filler, Tooltip, crosshairSync);

const DEFAULT_YEAR = 2024;

// "1:29.179" -> 89.179 seconds, so we can compute the gap between two laps.
function lapSeconds(str) {
  const [m, s] = str.split(":");
  return Number(m) * 60 + Number(s);
}

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
  // Up to two driver codes; order matters — [0] is the baseline (A), [1] the
  // comparison (B). One selected = classic single-driver view.
  const [selected, setSelected] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);

  // Loaded laps: [{driver, lap_time, telemetry, info}] — 1 or 2 entries.
  // Kept separate from `selected`, which the user may change afterwards.
  const [laps, setLaps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState(null); // which driver is fetching now
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false); // fetch >4s -> probably a cold start
  const [apiStatus, setApiStatus] = useState("waking");

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

  // Race changed -> reload driver list. Keep selected drivers that also took
  // part in the newly chosen race (nice when comparing races).
  useEffect(() => {
    if (round == null) return;
    setDriversLoading(true);
    setDrivers([]);
    fetchDrivers(year, round)
      .then((d) => {
        setDrivers(d.drivers);
        setSelected((prev) => prev.filter((c) => d.drivers.some((x) => x.code === c)));
      })
      .catch(() => setError("Couldn't load drivers for that race."))
      .finally(() => setDriversLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Click a driver card: toggle off if selected; add if there's room;
  // otherwise swap out the comparison slot and keep the baseline.
  function toggleDriver(code) {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length < 2
          ? [...prev, code]
          : [prev[0], code]
    );
  }

  const slowTimer = useRef(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setSlow(false);
    // If the response takes >4s, assume Render is cold-starting and say so.
    slowTimer.current = setTimeout(() => setSlow(true), 4000);
    try {
      // Sequential on purpose: the first request downloads + caches the
      // session server-side, so the second is fast — and the 512MB backend
      // never sees two heavy loads at once.
      const results = [];
      for (const code of selected) {
        setLoadingCode(code);
        const data = await fetchTelemetry(year, round, code);
        results.push({
          ...data,
          info: drivers.find((d) => d.code === code) ?? null,
          // /drivers returns quali classification order, so index = position
          qualiPos: drivers.findIndex((d) => d.code === code) + 1,
        });
      }
      setLaps(results);
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
      setLoadingCode(null);
    }
  }

  // ---- shape loaded laps into chart series ----
  // A and B may be teammates with the same color: B goes dashed in that case.
  const sameColor =
    laps?.length === 2 && laps[0].info?.color === laps[1].info?.color;

  const toSeries = (getY, i) => ({
    label: laps[i].driver,
    color: laps[i].info?.color ?? (i === 0 ? "#3b82f6" : "#f2f0eb"),
    dash: i === 1 && sameColor,
    points: laps[i].telemetry.map((p) => ({ x: p.Distance, y: getY(p) })),
  });

  const channelSeries = (getY) => laps.map((_, i) => toSeries(getY, i));

  const lapLength =
    laps && Math.max(...laps.map((l) => l.telemetry[l.telemetry.length - 1].Distance));

  const channels = laps && [
    { title: "Speed (km/h)", series: channelSeries((p) => p.Speed), height: 220, fill: laps.length === 1 },
    // delta only exists when there are two laps to compare
    ...(laps.length === 2
      ? [{
          title: `Δ ${laps[1].driver} to ${laps[0].driver} (s)`,
          series: [{
            label: `Δ ${laps[1].driver}`,
            color: sameColor ? "#f2f0eb" : laps[1].info?.color ?? "#f2f0eb",
            points: computeDelta(laps[0].telemetry, laps[1].telemetry),
          }],
          height: 130,
          zeroLine: true,
        }]
      : []),
    { title: "Throttle (%)", series: channelSeries((p) => p.Throttle), height: 110 },
    { title: "Brake", series: channelSeries((p) => Number(p.Brake)), height: 90, stepped: true },
    { title: "Gear", series: channelSeries((p) => p.nGear), height: 110, stepped: true, showX: true },
  ];

  const eventName = events.find((e) => e.round === round)?.name;

  // Gap between the two laps, signed from B's point of view (+ = B slower).
  const gap =
    laps?.length === 2 ? lapSeconds(laps[1].lap_time) - lapSeconds(laps[0].lap_time) : null;

  const analyzeLabel = loading
    ? loadingCode
      ? `Loading ${loadingCode}…`
      : "Loading…"
    : selected.length === 2
      ? "Compare laps"
      : "Analyze lap";

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
        drivers={drivers} selected={selected} onToggleDriver={toggleDriver} driversLoading={driversLoading}
        onAnalyze={analyze} analyzing={loading} analyzeLabel={analyzeLabel}
        summary={eventName ? `${eventName.replace(" Grand Prix", "")} ${year}` : ""}
      />

      {slow && (
        <div className="notice">
          Free-tier server is waking from sleep — the first request can take up to
          a minute. Data is cached after that.
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      {loading && !laps && (
        <div>
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 130 }} />
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 90 }} />
        </div>
      )}

      {laps && (
        <>
          <div className="overview">
            <TrackMap points={laps[0].telemetry} label={laps[0].driver} />
          <div className="cards">
            {laps.map((lap, i) => (
              <div className="card" key={lap.driver}>
                <div className="label">
                  <span
                    className="swatch"
                    style={{ background: lap.info?.color ?? "#888" }}
                  />
                  {lap.info?.name ?? lap.driver}
                  {lap.qualiPos > 0 && <span className="pos-tag">P{lap.qualiPos}</span>}
                  {laps.length === 2 && <span className="slot-tag">{i === 0 ? "A" : "B"}</span>}
                </div>
                <div className="value">{lap.lap_time}</div>
                <div className="sub">
                  {lap.info?.team} · top {Math.round(Math.max(...lap.telemetry.map((p) => p.Speed)))} km/h
                </div>
              </div>
            ))}
            {gap != null && (
              <div className="card">
                <div className="label">Gap (B to A)</div>
                <div className="value">{gap >= 0 ? "+" : "−"}{Math.abs(gap).toFixed(3)}s</div>
                <div className="sub">{laps[gap >= 0 ? 0 : 1].driver} ahead</div>
              </div>
            )}
          </div>
          </div>

          <div className="charts">
            <div className="charts-head">
              <h2>{eventName} — qualifying telemetry</h2>
              <div className="legend">
                <span className="lap-len">{(lapLength / 1000).toFixed(3)} km</span>
                {laps.map((lap, i) => {
                  const c = lap.info?.color ?? "#888";
                  return (
                    <span className="legend-chip" key={lap.driver}>
                      <span
                        className="legend-line"
                        style={{
                          // teammate case: B is dashed in the charts, mirror it here
                          background:
                            i === 1 && sameColor
                              ? `repeating-linear-gradient(90deg, ${c} 0 5px, transparent 5px 9px)`
                              : c,
                        }}
                      />
                      {lap.driver}
                    </span>
                  );
                })}
              </div>
            </div>
            {channels.map((ch) => (
              <ChannelChart key={ch.title} xMax={lapLength} {...ch} />
            ))}
          </div>
        </>
      )}

      {!laps && !loading && (
        <div className="empty">
          <svg width="220" height="40" viewBox="0 0 220 40" aria-hidden="true">
            <path
              d="M0 32 L30 32 L45 10 L70 10 L82 30 L110 30 L122 8 L150 8 L165 28 L200 28 L220 12"
              fill="none" stroke="#63605b" strokeWidth="1.5" strokeLinejoin="round"
            />
          </svg>
          Pick a season, a race, and one or two drivers — then analyze their
          fastest qualifying laps head-to-head.
        </div>
      )}
    </div>
    </>
  );
}

export default App;
