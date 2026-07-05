const STATUS_TEXT = {
  waking: "Waking the backend — free tier, can take up to a minute",
  live: "Backend live",
  down: "Backend unreachable",
};

// Landing screen. `exiting` triggers the slide-up CSS transition; App
// unmounts this after the animation finishes.
function Cover({ exiting, onEnter, apiStatus }) {
  return (
    <div className={`cover${exiting ? " exit" : ""}`}>
      <div className="cover-inner">
        <div className="wordmark xl fade-1">
          PIT<span className="bar">|</span>WALL
        </div>
        <p className="tagline fade-2">Formula 1 telemetry, corner by corner.</p>
        <p className="cover-sub fade-2">
          Real qualifying data · speed, throttle, brake &amp; gear traces · every season since 2019
        </p>
        <button className="enter fade-3" onClick={onEnter}>
          Enter the pit wall
        </button>
        <div className="api-status fade-3">
          <span className={`dot ${apiStatus}`} />
          {STATUS_TEXT[apiStatus]}
        </div>
      </div>

      {/* a lap trace that draws itself in — pure CSS stroke-dashoffset */}
      <svg className="speedline" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,95 L80,30 L130,26 L170,82 L230,34 L300,28 L340,88 L400,40 L470,30 L520,94 L580,36 L650,30 L720,90 L790,42 L860,32 L930,92 L1000,38 L1080,30 L1200,26" />
      </svg>
    </div>
  );
}

export default Cover;
