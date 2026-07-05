// Delta-time trace between two laps: at each point of lap A, how far
// ahead/behind is lap B on the stopwatch?
//
// The two cars never sample telemetry at identical distances, so B's
// elapsed time is linearly interpolated at every distance A recorded.
// delta(d) = timeB(d) - timeA(d) -> positive means B is losing time.
//
// Caveat worth knowing: the trace's final value won't exactly equal the
// official lap-time gap. Car telemetry is sampled at ~4Hz and interpolated
// by FastF1, so the endpoints drift by a tenth or two — official gaps come
// from track timing loops, not telemetry. The *shape* (where time is
// gained/lost) is what this chart is for.
export function computeDelta(a, b) {
  const points = [];
  let j = 0;
  for (const p of a) {
    // advance j so b[j]..b[j+1] brackets p.Distance (both sorted ascending)
    while (j < b.length - 2 && b[j + 1].Distance < p.Distance) j++;
    const b0 = b[j];
    const b1 = b[Math.min(j + 1, b.length - 1)];
    const span = b1.Distance - b0.Distance;
    const f = span > 0 ? (p.Distance - b0.Distance) / span : 0;
    // clamp so we extrapolate flat, not linearly, past B's first/last sample
    const timeB = b0.Time + (b1.Time - b0.Time) * Math.min(Math.max(f, 0), 1);
    points.push({ x: p.Distance, y: +(timeB - p.Time).toFixed(3) });
  }
  return points;
}
