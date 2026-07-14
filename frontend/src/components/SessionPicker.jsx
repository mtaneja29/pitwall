const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];

const SESSION_LABELS = {
  FP1: "FP1", FP2: "FP2", FP3: "FP3",
  SQ: "Sprint Quali", S: "Sprint", Q: "Qualifying", R: "Race",
};

function SessionPicker({
  year, onYear,
  events, round, onRound, eventsLoading,
  sessions, sessionType, onSession,
  drivers, selected, onToggleDriver, driversLoading,
  onAnalyze, analyzing, analyzeLabel, onSwap,
}) {
  return (
    <div className="picker">
      
      <div className="picker-section">
        <label className="picker-label">Season</label>
        <select className="season-select" value={year} onChange={(e) => onYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="picker-section scrollable">
        <label className="picker-label">Grand Prix</label>
        <div className="race-list">
          {eventsLoading &&
            [...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 42, marginBottom: 8 }} />
            ))}
          {events.map((ev) => (
            <button
              key={ev.round}
              className={`race-item${ev.round === round ? " sel" : ""}`}
              onClick={() => onRound(ev.round)}
            >
              <span className="round">R{ev.round}</span>
              <span className="rname">{ev.name.replace(" Grand Prix", "")}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="picker-section">
        <label className="picker-label">Session</label>
        <div className="session-grid">
          {(sessions.length ? sessions : [{ code: "Q", name: "Qualifying" }]).map((s) => (
            <button
              key={s.code}
              className={`pill${s.code === sessionType ? " sel" : ""}`}
              title={s.name}
              onClick={() => onSession(s.code)}
            >
              {SESSION_LABELS[s.code] ?? s.code}
            </button>
          ))}
        </div>
      </div>

      <div className="picker-section scrollable-drivers">
        <label className="picker-label">
          Drivers <span className="hint">(pick 1 or 2)</span>
        </label>
        <div className="driver-list">
          {driversLoading &&
            [...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36, marginBottom: 4 }} />)}
          {drivers.map((d) => {
            const slot = selected.indexOf(d.code);
            return (
              <button
                key={d.code}
                className={`driver-item${slot >= 0 ? " sel" : ""}`}
                style={{ "--team": d.color }}
                onClick={() => onToggleDriver(d.code)}
                title={d.team}
              >
                <span className="team-bar" />
                <span className="code">{d.code}</span>
                <span className="dname">{d.name}</span>
                {slot >= 0 && <span className="slot">{slot === 0 ? "A" : "B"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="picker-footer">
        <div className="selection-summary">
          {selected.length > 0 && (
            <div className="matchup">
              {selected[0]}
              {selected[1] && <><span className="vs"> vs </span>{selected[1]}</>}
              {onSwap && selected.length === 2 && (
                <button className="swap-btn" onClick={onSwap} title="Swap A/B">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10h14l-4-4M17 14H3l4 4"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
        <button className="analyze" onClick={onAnalyze} disabled={analyzing || selected.length === 0}>
          {analyzeLabel}
        </button>
      </div>
    </div>
  );
}

export default SessionPicker;
