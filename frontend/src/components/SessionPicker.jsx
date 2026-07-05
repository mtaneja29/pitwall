// Session selection as tactile controls instead of dropdowns:
// season pills -> scrollable race chips -> driver cards in team colors.
// Still fully controlled: App owns the state, this renders it.
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];

// short labels for the session pills; full name goes in the tooltip
const SESSION_LABELS = {
  FP1: "FP1", FP2: "FP2", FP3: "FP3",
  SQ: "Sprint Quali", S: "Sprint", Q: "Qualifying", R: "Race",
};

function SessionPicker({
  year, onYear,
  events, round, onRound, eventsLoading,
  sessions, sessionType, onSession,
  drivers, selected, onToggleDriver, driversLoading,
  onAnalyze, analyzing, analyzeLabel, summary,
}) {
  return (
    <div className="picker">
      <div className="picker-label">Season</div>
      <div className="pills">
        {YEARS.map((y) => (
          <button key={y} className={`pill${y === year ? " sel" : ""}`} onClick={() => onYear(y)}>
            {y}
          </button>
        ))}
      </div>

      <div className="picker-label">Grand Prix</div>
      <div className="race-row">
        {eventsLoading &&
          [...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 110, height: 46, flex: "0 0 auto" }} />
          ))}
        {events.map((ev) => (
          <button
            key={ev.round}
            className={`race-chip${ev.round === round ? " sel" : ""}`}
            onClick={() => onRound(ev.round)}
          >
            <span className="round">
              R{ev.round}{" "}
              <span className="rdate">
                · {new Date(ev.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </span>
            </span>
            <span className="rname">{ev.name.replace(" Grand Prix", "")}</span>
          </button>
        ))}
      </div>

      <div className="picker-label">Session</div>
      <div className="pills">
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

      <div className="picker-label">
        Drivers <span className="hint">— pick one, or two to compare</span>
      </div>
      <div className="driver-grid">
        {driversLoading &&
          [...Array(10)].map((_, i) => <div key={i} className="skeleton" style={{ height: 54 }} />)}
        {drivers.map((d) => {
          const slot = selected.indexOf(d.code); // 0 = primary, 1 = comparison
          return (
            <button
              key={d.code}
              className={`driver-card${slot >= 0 ? " sel" : ""}`}
              style={{ "--team": d.color }}
              onClick={() => onToggleDriver(d.code)}
              title={d.team}
            >
              <span className="team-bar" />
              <span className="code">{d.code}</span>
              {slot >= 0 && <span className="slot">{slot === 0 ? "A" : "B"}</span>}
              <div className="dname">{d.name}</div>
            </button>
          );
        })}
      </div>

      <div className="picker-footer">
        <span className="selection-summary">
          {selected.length > 0 && (
            <>
              {selected[0]}
              {selected[1] && <><span className="vs"> vs </span>{selected[1]}</>}
              {summary && ` — ${summary}`}
            </>
          )}
        </span>
        <button className="analyze" onClick={onAnalyze} disabled={analyzing || selected.length === 0}>
          {analyzeLabel}
        </button>
      </div>
    </div>
  );
}

export default SessionPicker;
