import { useEffect, useState } from "react";

const STATUS_TEXT = {
  waking: "Waking backend — free tier, may take a minute",
  live: "Backend live",
  down: "Backend unreachable",
};

// Landing screen. Launching runs a real F1 start sequence: five columns of
// red lights come on one by one, hold, then go out — and away we go (the
// cover slides up). `exiting` triggers the slide; App unmounts this after
// the animation finishes.
const LAUNCH_MS = 1750; // 5 columns x 250ms on + hold + lights out at 1.5s

function Cover({ exiting, onEnter, apiStatus }) {
  const [launching, setLaunching] = useState(false);

  function launch() {
    if (launching) return;
    setLaunching(true);
    setTimeout(onEnter, LAUNCH_MS);
  }

  // Enter key starts the sequence — the fastest way in for repeat visitors.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") launch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launching]);

  return (
    <div className={`cover${exiting ? " exit" : ""}${launching ? " launching" : ""}`}>
      {/* white pulse the instant the lights go out */}
      <div className="lights-out-flash" aria-hidden="true" />

      <div className="cover-inner">
        {/* start-light gantry: 5 columns x 2 bulbs, like the real thing.
            Both bulbs in a column share the same --i, so they light together. */}
        <div className="startlights" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="light-col" style={{ "--i": i }}>
              <span className="light" />
              <span className="light" />
            </span>
          ))}
        </div>

        <div className="wordmark xl fade-1">
          PIT<span className="bar">|</span>WALL
        </div>
        <p className="tagline fade-2">Formula 1 telemetry, corner by corner.</p>

        <div className="feature-strip fade-2" aria-label="Features">
          <span>Lap comparison</span>
          <span>Δ time</span>
          <span>Track map</span>
          <span>Every session since 2019</span>
        </div>

        <button className="enter fade-3" onClick={launch} disabled={launching}>
          {launching ? "Lights out…" : "Start session"}
        </button>
        <div className="enter-hint fade-3">or press Enter</div>

        <div className="api-status fade-3">
          <span className={`dot ${apiStatus}`} />
          {STATUS_TEXT[apiStatus]}
        </div>
      </div>

      {/* two lap traces racing each other across the bottom — a hint at the
          comparison feature. Pure CSS stroke-dashoffset draw. */}
      <svg className="speedline" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="trace-a" d="M0,95 L80,30 L130,26 L170,82 L230,34 L300,28 L340,88 L400,40 L470,30 L520,94 L580,36 L650,30 L720,90 L790,42 L860,32 L930,92 L1000,38 L1080,30 L1200,26" />
        <path className="trace-b" d="M0,98 L84,34 L134,29 L166,86 L236,37 L304,30 L336,92 L406,44 L474,32 L516,98 L586,39 L654,32 L714,94 L796,45 L866,34 L924,96 L1006,41 L1086,32 L1200,29" />
      </svg>

      <div className="cover-credit fade-3">
        Data · FastF1 &nbsp;—&nbsp; FastAPI · React · Chart.js
      </div>
    </div>
  );
}

export default Cover;
