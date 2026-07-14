import { useEffect, useMemo, useRef } from "react";
import { onCrosshairMove } from "../crosshairSync";

// Track map drawn from the lap's X/Y coordinates, colored by speed.
// Rendered as SVG: one short <path> per telemetry sample, stroked with a
// color picked from the speed scale — no map images, the racing line IS
// the data.

// slow -> fast color stops (blue -> green -> amber -> F1 red)
const STOPS = [
  [59, 130, 246],
  [63, 214, 140],
  [245, 185, 68],
  [225, 6, 0],
];

// t in [0,1] -> css color interpolated across STOPS
function speedColor(t) {
  const pos = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(pos), STOPS.length - 2);
  const f = pos - i;
  const c = STOPS[i].map((a, k) => Math.round(a + (STOPS[i + 1][k] - a) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const W = 320;
const H = 300;
const PAD = 18;

function TrackMap({ points, label }) {
  // Scale raw FastF1 world coordinates into the SVG viewBox once per lap.
  // SVG y grows downward while track Y grows upward -> flip it.
  const { segments, toSvg, sfLine } = useMemo(() => {
    const xs = points.map((p) => p.X);
    const ys = points.map((p) => p.Y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // one scale for both axes so the circuit keeps its real proportions
    const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY));
    const offX = (W - (maxX - minX) * scale) / 2;
    const offY = (H - (maxY - minY) * scale) / 2;
    const toSvg = (p) => ({
      x: offX + (p.X - minX) * scale,
      y: H - (offY + (p.Y - minY) * scale),
    });

    const speeds = points.map((p) => p.Speed);
    const minS = Math.min(...speeds), maxS = Math.max(...speeds);
    const segments = [];
    for (let i = 1; i < points.length; i++) {
      const a = toSvg(points[i - 1]);
      const b = toSvg(points[i]);
      // color the segment by the speed at its end point
      const t = (points[i].Speed - minS) / (maxS - minS || 1);
      segments.push({
        d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
        color: speedColor(t),
      });
    }

    // start/finish line: a short tick perpendicular to the direction of
    // travel at the first sample (Distance 0 = crossing the line)
    const p0 = toSvg(points[0]);
    const p1 = toSvg(points[Math.min(4, points.length - 1)]);
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const nx = -(p1.y - p0.y) / len; // unit normal
    const ny = (p1.x - p0.x) / len;
    const sfLine = {
      x1: p0.x - nx * 7, y1: p0.y - ny * 7,
      x2: p0.x + nx * 7, y2: p0.y + ny * 7,
      lx: p0.x + nx * 15, ly: p0.y + ny * 15, // label offset
    };

    return { segments, toSvg, sfLine };
  }, [points]);

  // Crosshair -> move the position dot. Direct attribute updates through a
  // ref: the dot follows the charts' hover without a single React re-render.
  const dotRef = useRef(null);
  useEffect(() => {
    return onCrosshairMove((dist) => {
      const dot = dotRef.current;
      if (!dot) return;
      if (dist == null) {
        dot.style.opacity = 0;
        return;
      }
      // binary search: telemetry is sorted by Distance
      let lo = 0, hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].Distance < dist) lo = mid + 1;
        else hi = mid;
      }
      const { x, y } = toSvg(points[lo]);
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.style.opacity = 1;
    });
  }, [points, toSvg]);

  return (
    <div className="trackmap">
      <div className="trackmap-head">
        <span className="trackmap-title">Track map</span>
        <span className="trackmap-driver">racing line · {label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Track map colored by speed for ${label}`}>
        {segments.map((s, i) => (
          <path
            key={i}
            className="seg"
            d={s.d}
            stroke={s.color}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            // stagger by index: the racing line draws itself around the lap
            style={{ animationDelay: `${i * 2}ms` }}
          />
        ))}
        <line
          x1={sfLine.x1} y1={sfLine.y1} x2={sfLine.x2} y2={sfLine.y2}
          stroke="#e9edf6" strokeWidth="2.5" opacity="0.85"
        />
        <text x={sfLine.lx} y={sfLine.ly} className="sf-label" textAnchor="middle" dominantBaseline="middle">
          S/F
        </text>
        <circle ref={dotRef} r="5" fill="#fff" stroke="#0b0b0d" strokeWidth="1.5" style={{ opacity: 0 }} />
      </svg>
      <div className="trackmap-scale">
        <span>slow</span>
        <span className="scale-bar" />
        <span>fast</span>
      </div>
    </div>
  );
}

export default TrackMap;
