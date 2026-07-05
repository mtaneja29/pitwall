import { Line } from "react-chartjs-2";

// One telemetry channel (speed, throttle, ...) as a line chart.
// Reusable: App renders this once per channel with different props.
//
// Props:
//   title    — y-axis label, e.g. "Speed (km/h)"
//   series   — [{label, points: [{x,y}], color, dash}] — one entry per driver
//   xMax     — lap length, so every chart spans the same x range
//   stepped  — true for gear/brake (jumps between values, no slope)
//   showX    — only the bottom chart shows the distance axis labels
//   height   — px height of this chart's box
//   zeroLine — emphasize y=0 gridline (used by the delta chart)
//   fill     — soft area fill under each line (used by the speed chart)
function ChannelChart({ title, series, xMax, stepped = false, showX = false, height = 140, zeroLine = false, fill = false }) {
  const data = {
    datasets: series.map((s) => ({
      label: s.label,
      data: s.points, // {x, y} pairs -> Chart.js plots on a real numeric axis
      borderColor: s.color,
      borderWidth: 1.6,
      pointRadius: 0,
      stepped,
      // Two drivers from the same team share a color — the dash pattern is
      // what keeps them tellable apart in that case.
      borderDash: s.dash ? [6, 4] : undefined,
      fill: fill ? "origin" : false,
      backgroundColor: fill ? `${s.color}14` : undefined, // ~8% alpha hex suffix
    })),
  };

  const grid = { color: "rgba(164,190,255,0.06)" };
  const ticks = { color: "#565e73", font: { size: 10, family: "'B612 Mono', monospace" } };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // fill the fixed-height div instead of 2:1 default
    animation: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(11,13,23,0.95)",
        borderColor: "#1c2134",
        borderWidth: 1,
        titleFont: { family: "'B612 Mono', monospace", size: 10 },
        bodyFont: { family: "'B612 Mono', monospace", size: 11 },
        callbacks: {
          title: (items) => `${Math.round(items[0].parsed.x)} m`,
          label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(zeroLine ? 3 : 1)}`,
        },
      },
    },
    scales: {
      x: {
        type: "linear", // real distance values, not evenly-spaced labels
        min: 0,
        max: xMax,
        grid,
        ticks: { ...ticks, display: showX, callback: (v) => Math.round(v).toLocaleString() },
        title: { display: showX, text: "Distance (m)", color: "#8b93a8", font: { size: 11 } },
      },
      y: {
        grid: zeroLine
          ? { color: (ctx) => (ctx.tick.value === 0 ? "rgba(233,237,246,0.35)" : "rgba(164,190,255,0.06)") }
          : grid,
        ticks,
        title: { display: true, text: title, color: "#8b93a8", font: { size: 11 } },
        // Force every chart's y-axis to the same width so the plot areas
        // line up vertically — otherwise "320" (speed) is wider than "1" (brake).
        afterFit: (scale) => {
          scale.width = 64;
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}

export default ChannelChart;
