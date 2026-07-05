// apiStatus: "waking" | "live" | "down" — the dot tells visitors the free-tier
// backend may need ~50s to spin up, instead of the app just looking broken.
const STATUS_TEXT = {
  waking: "API waking up…",
  live: "API live",
  down: "API unreachable",
};

function Header({ apiStatus }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="wordmark">
          PIT<span className="bar">|</span>WALL
        </span>
        <nav className="tabs">
          <span className="tab active">Telemetry</span>
          <span className="tab soon" title="ML race predictor — in progress">
            Prediction · soon
          </span>
        </nav>
      </div>
      <div className="api-status">
        <span className={`dot ${apiStatus}`} />
        {STATUS_TEXT[apiStatus]}
      </div>
    </header>
  );
}

export default Header;
