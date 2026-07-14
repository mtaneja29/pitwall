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

// Last picked session, restored on the next visit. localStorage can throw
// (private mode, disabled storage) — treat it as best-effort.
const PREFS_KEY = "pitwall-prefs";

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

// Read once at module load; fields are consumed (cleared) as each level of
// the picker restores itself, so later fetches fall back to defaults.
const restore = loadPrefs();

function App() {
  // Landing -> app transition: "cover" shows the landing page, "exiting"
  // plays the slide-up animation with the app already rendered behind it,
  // "app" unmounts the cover entirely.
  const [stage, setStage] = useState("cover");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function enterApp() {
    setStage("exiting");
    setTimeout(() => setStage("app"), 700); // matches the CSS transition
  }

  // Selection chain: year -> events (races) -> drivers. Each level's options
  // are fetched when the level above changes.
  const [year, setYear] = useState(restore.year ?? DEFAULT_YEAR);
  const [events, setEvents] = useState([]);
  const [round, setRound] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  // Session within the race weekend (Q by default; sprint weekends add more)
  const [sessionType, setSessionType] = useState(restore.session ?? "Q");
  // Up to two driver codes; order matters — [0] is the baseline (A), [1] the
  // comparison (B). One selected = classic single-driver view.
  const [selected, setSelected] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);

  // Loaded laps: [{driver, lap_time, telemetry, info}] — 1 or 2 entries.
  // Kept separate from `selected`, which the user may change afterwards.
  const [laps, setLaps] = useState(null);
  const [loadedMeta, setLoadedMeta] = useState(null); // {eventName, sessionName} at load time
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

  // Browser tab reflects what's loaded — useful with several tabs open.
  useEffect(() => {
    document.title = loadedMeta
      ? `PitWall — ${loadedMeta.eventName.replace(" Grand Prix", "")} · ${loadedMeta.sessionName}`
      : "PitWall — F1 telemetry";
  }, [loadedMeta]);

  // The stored session pick may not exist for the selected weekend (chose
  // Sprint in China, then clicked Bahrain). Derive the effective session at
  // render rather than clamping state in an effect — the preference
  // survives, so switching back to a sprint weekend restores it.
  const availableSessions = events.find((e) => e.round === round)?.sessions ?? [];
  const effectiveSession = (
    availableSessions.length ? availableSessions.map((s) => s.code) : ["Q"]
  ).includes(sessionType)
    ? sessionType
    : "Q";

  // Year changed -> reload race list, keep first race selected.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-param-change
       with a loading flag; the synchronous reset before the request is the
       point, not an accident */
    setEventsLoading(true);
    setEvents([]);
    setRound(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchSchedule(year)
      .then((d) => {
        setEvents(d.events);
        // first load only: put the user back on the race they had open
        const saved = restore.round;
        restore.round = undefined;
        setRound(
          d.events.some((e) => e.round === saved) ? saved : d.events[0]?.round ?? null
        );
        setApiStatus("live");
        setError(null);
      })
      .catch(() => setError("Couldn't load the race calendar."))
      .finally(() => setEventsLoading(false));
  }, [year]);

  // Race or session changed -> reload the driver classification. Keep
  // selected drivers that also took part (nice when comparing sessions).
  useEffect(() => {
    if (round == null) return;
    /* eslint-disable react-hooks/set-state-in-effect -- same fetch-on-change
       pattern as above */
    setDriversLoading(true);
    setDrivers([]);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchDrivers(year, round, effectiveSession)
      .then((d) => {
        setDrivers(d.drivers);
        // first load only: restore last session's driver picks
        const saved = restore.selected;
        restore.selected = undefined;
        setSelected((prev) => {
          const wanted = saved?.length ? saved : prev;
          return wanted.filter((c) => d.drivers.some((x) => x.code === c)).slice(0, 2);
        });
        setError(null);
      })
      .catch(() => setError("Couldn't load drivers for that session."))
      .finally(() => setDriversLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, effectiveSession]);

  // Remember the selection for the next visit.
  useEffect(() => {
    if (round == null) return;
    savePrefs({ year, round, session: sessionType, selected });
  }, [year, round, sessionType, selected]);

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

  // Swap baseline and comparison. Loaded laps swap too — the data's already
  // here, so the delta trace, table, and map flip instantly with no refetch.
  function swapDrivers() {
    setSelected((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
    setLaps((prev) => (prev?.length === 2 ? [prev[1], prev[0]] : prev));
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
        const data = await fetchTelemetry(year, round, code, effectiveSession);
        results.push({
          ...data,
          info: drivers.find((d) => d.code === code) ?? null,
          // /drivers returns quali classification order, so index = position
          qualiPos: drivers.findIndex((d) => d.code === code) + 1,
        });
      }
      setLaps(results);
      const ev = events.find((e) => e.round === round);
      setLoadedMeta({
        eventName: ev?.name ?? "",
        round,
        sessionName: ev?.sessions?.find((s) => s.code === effectiveSession)?.name ?? "Qualifying",
      });
      setApiStatus("live");
      // bring the fresh results into view once they've rendered
      setTimeout(() => {
        document.querySelector(".overview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
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
    color: laps[i].info?.color ?? (i === 0 ? "#e0e0e0" : "#808080"),
    dash: i === 1 && sameColor,
    points: laps[i].telemetry.map((p) => ({ x: p.Distance, y: getY(p) })),
  });

  const channelSeries = (getY) => laps.map((_, i) => toSeries(getY, i));

  const lapLength =
    laps && Math.max(...laps.map((l) => l.telemetry[l.telemetry.length - 1].Distance));

  const channels = laps && [
    {
      title: "Speed (km/h)",
      series: channelSeries((p) => p.Speed),
      height: 220,
      fill: laps.length === 1,
      fmt: (y) => `${Math.round(y)} km/h`,
    },
    // delta only exists when there are two laps to compare
    ...(laps.length === 2
      ? [{
          title: `Δ ${laps[1].driver} to ${laps[0].driver} (s)`,
          series: [{
            label: `Δ ${laps[1].driver}`,
            color: sameColor ? "#808080" : laps[1].info?.color ?? "#808080",
            points: computeDelta(laps[0].telemetry, laps[1].telemetry),
          }],
          height: 130,
          zeroLine: true,
          fmt: (y) => `${y >= 0 ? "+" : ""}${y.toFixed(3)}s`,
        }]
      : []),
    {
      title: "Throttle (%)",
      series: channelSeries((p) => p.Throttle),
      height: 110,
      fmt: (y) => `${Math.round(y)}%`,
    },
    {
      title: "Brake",
      series: channelSeries((p) => Number(p.Brake)),
      height: 90,
      stepped: true,
      fmt: (y) => (y > 0.5 ? "ON" : "off"),
    },
    {
      title: "Gear",
      series: channelSeries((p) => p.nGear),
      height: 110,
      stepped: true,
      showX: true,
      fmt: (y) => `${Math.round(y)}`,
    },
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
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="wordmark">
            PIT<span className="bar">|</span>WALL
          </span>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">✕</button>
        </div>
        <SessionPicker
          year={year} onYear={setYear}
          events={events} round={round} onRound={setRound} eventsLoading={eventsLoading}
          sessions={availableSessions}
          sessionType={effectiveSession} onSession={setSessionType}
          drivers={drivers} selected={selected} onToggleDriver={toggleDriver} driversLoading={driversLoading}
          onAnalyze={() => { setSidebarOpen(false); analyze(); }} analyzing={loading} analyzeLabel={analyzeLabel}
          onSwap={selected.length === 2 ? swapDrivers : null}
        />
      </aside>

      <main className="main-content">
        <Header 
          apiStatus={apiStatus} 
          onMenuClick={() => setSidebarOpen(true)} 
          contextTitle={eventName ? `${eventName.replace(" Grand Prix", "")} ${year} · ${
            {SQ: "Sprint Quali", S: "Sprint", Q: "Qualifying", R: "Race"}[effectiveSession] || effectiveSession
          }` : ""}
        />
        
        <div className="dashboard-scroller">
          {slow && (
        <div className="notice">
          Free-tier server is waking from sleep — the first request can take up to
          a minute. Data is cached after that.
        </div>
      )}
      {error && (
        <div className="notice error">
          <span>{error}</span>
          <button className="dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

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

            {/* classification strip, timing-tower style: fastest lap first,
                purple time per FIA convention */}
            <div className="results">
              {/* oversized ghost round number — editorial depth, zero layout cost */}
              <span className="ghost-round" aria-hidden="true">
                R{loadedMeta?.round}
              </span>
              <div className="results-head">
                <span className="results-event">
                  {loadedMeta?.eventName?.replace(" Grand Prix", "")}
                </span>
                <span className="session-chip">{loadedMeta?.sessionName}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Lap time</th>
                    <th>Top speed</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {[...laps]
                    .map((lap, i) => ({ lap, slot: i }))
                    .sort((a, b) => lapSeconds(a.lap.lap_time) - lapSeconds(b.lap.lap_time))
                    .map(({ lap, slot }, row) => (
                      <tr key={lap.driver}>
                        <td className="pos">{lap.qualiPos > 0 ? `P${lap.qualiPos}` : "—"}</td>
                        <td className="drv">
                          <span className="teambar" style={{ background: lap.info?.color ?? "#888" }} />
                          <b>{lap.driver}</b>
                          <span className="dname">{lap.info?.name}</span>
                          {laps.length === 2 && (
                            <span className="slot-tag">{slot === 0 ? "A" : "B"}</span>
                          )}
                        </td>
                        <td className="team">{lap.info?.team}</td>
                        <td className={`time${laps.length === 2 && row === 0 ? " fastest" : ""}`}>
                          {lap.lap_time}
                        </td>
                        <td className="spd">
                          {Math.round(Math.max(...lap.telemetry.map((p) => p.Speed)))} km/h
                        </td>
                        <td className="gapc">
                          {row === 0 ? "—" : `+${Math.abs(gap).toFixed(3)}`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts">
            <div className="charts-head">
              <h2>{loadedMeta?.sessionName ?? "Session"} telemetry — fastest laps</h2>
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
              fill="none" stroke="#5c7280" strokeWidth="1.5" strokeLinejoin="round"
            />
          </svg>
          Pick a season, a race, and one or two drivers — then analyze their
          fastest qualifying laps head-to-head.
        </div>
      )}
        </div>
      </main>
    </div>
    </>
  );
}

export default App;
