const STATUS_TEXT = {
  waking: "API waking up…",
  live: "API live",
  down: "API unreachable",
};

function Header({ apiStatus, onMenuClick, contextTitle }) {
  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuClick} aria-label="Open sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="context-title">{contextTitle || "Select a session to analyze"}</span>
      </div>
      <div className="api-status">
        <span className={`dot ${apiStatus}`} />
        {STATUS_TEXT[apiStatus]}
      </div>
    </header>
  );
}

export default Header;
