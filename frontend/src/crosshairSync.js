// Synced crosshair across every chart on the page.
//
// How it works: all charts share one module-level state object holding the
// hovered distance. On hover, the chart under the cursor converts pixel ->
// distance (getValueForPixel), stores it, and asks the *other* charts to
// redraw; each chart's afterDraw then paints a vertical line at that
// distance converted back to its own pixels.
//
// Interview landmine: doing this through React state would re-render four
// charts on every mousemove. Chart.js `chart.draw()` just repaints the
// existing canvas — no setState, no reconciliation, no data rebuild.

const charts = new Set(); // every live chart instance
const listeners = new Set(); // non-chart subscribers (track map dot)
let hoverDist = null; // distance (m) under the cursor, null = no hover

// Subscribe to crosshair moves; returns an unsubscribe function
// (used by TrackMap to move its position dot without re-rendering).
export function onCrosshairMove(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const crosshairSync = {
  id: "crosshairSync",

  afterInit(chart) {
    charts.add(chart);
  },
  afterDestroy(chart) {
    charts.delete(chart);
  },

  afterEvent(chart, args) {
    const e = args.event;
    let dist = null;
    if (e.type !== "mouseout" && e.x != null) {
      const { left, right } = chart.chartArea;
      if (e.x >= left && e.x <= right) {
        dist = chart.scales.x.getValueForPixel(e.x);
      }
    }
    if (dist === hoverDist) return;
    hoverDist = dist;
    args.changed = true; // repaint this chart
    for (const c of charts) {
      if (c !== chart) c.draw(); // repaint siblings, no full update
    }
    for (const fn of listeners) fn(dist);
  },

  afterDraw(chart) {
    if (hoverDist == null) return;
    const x = chart.scales.x.getPixelForValue(hoverDist);
    const { top, bottom, left, right } = chart.chartArea;
    if (x < left || x > right) return;
    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = "rgba(242, 240, 235, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};
