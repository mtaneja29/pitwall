// Controlled selects: App owns all the state, this just renders it.
// Each dropdown's options come from the previous one's API call
// (year -> /schedule -> race -> /drivers -> driver).
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];

function ControlBar({
  year, onYear,
  events, round, onRound, eventsLoading,
  drivers, driver, onDriver, driversLoading,
  onAnalyze, analyzing,
}) {
  return (
    <div className="controls">
      <div className="field">
        <label>Season</label>
        <select value={year} onChange={(e) => onYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Grand Prix</label>
        <select
          value={round ?? ""}
          onChange={(e) => onRound(Number(e.target.value))}
          disabled={eventsLoading || events.length === 0}
        >
          {eventsLoading && <option>Loading races…</option>}
          {events.map((ev) => (
            <option key={ev.round} value={ev.round}>
              R{ev.round} · {ev.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Driver</label>
        <select
          value={driver}
          onChange={(e) => onDriver(e.target.value)}
          disabled={driversLoading || drivers.length === 0}
        >
          {driversLoading && <option>Loading drivers…</option>}
          {drivers.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>

      <button className="analyze" onClick={onAnalyze} disabled={analyzing || !driver}>
        {analyzing ? "Loading…" : "Analyze lap"}
      </button>
    </div>
  );
}

export default ControlBar;
