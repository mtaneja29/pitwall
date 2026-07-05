import { useState } from "react";

const STATUS_TEXT = {
  waking: "Waking the backend — free tier, can take up to a minute",
  live: "Backend live",
  down: "Backend unreachable",
};

// Landing screen. Clicking the button runs a real F1 start sequence: five
// red lights come on one by one, hold, then go out — and away we go (the
// cover slides up). `exiting` triggers the slide; App unmounts this after
// the animation finishes.
const LAUNCH_MS = 1750; // 5 lights x 250ms on + hold + lights out at 1.5s

function Cover({ exiting, onEnter, apiStatus }) {
  const [launching, setLaunching] = useState(false);

  function launch() {
    if (launching) return;
    setLaunching(true);
    setTimeout(onEnter, LAUNCH_MS);
  }

  return (
    <div className={`cover${exiting ? " exit" : ""}${launching ? " launching" : ""}`}>
      <div className="cover-inner">
        {/* start-light gantry — lights driven purely by CSS animation-delay */}
        <div className="startlights fade-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="light" style={{ "--i": i }} />
          ))}
        </div>

        <div className="wordmark xl fade-1">
          PIT<span className="bar">|</span>WALL
        </div>
        <p className="tagline fade-2">Formula 1 telemetry, corner by corner.</p>
        <p className="cover-sub fade-2">
          Real qualifying data · speed, throttle, brake &amp; gear traces · every season since 2019
        </p>
        <button className="enter fade-3" onClick={launch} disabled={launching}>
          {launching ? "Lights out…" : "Start lights"}
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
