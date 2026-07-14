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
//   fmt      — tooltip value formatter, e.g. brake -> "ON"/"off"
function ChannelChart({ title, series, xMax, stepped = false, showX = false, height = 140, zeroLine = false, fill = false, fmt }) {
  const data = {
    datasets: series.map((s) => ({
      label: s.label,
      data: s.points, // {x, y} pairs -> Chart.js plots on a real numeric axis
      parsing: false, // Huge performance boost for large datasets
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

  const grid = { color: "rgba(255,255,255,0.04)" };
  const ticks = { color: "#5a5a5a", font: { size: 10, family: "'JetBrains Mono', monospace" } };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // fill the fixed-height div instead of 2:1 default
    animation: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      decimation: { enabled: true, algorithm: "lttb" },
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(10,10,10,0.95)",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: { family: "'JetBrains Mono', monospace", size: 10 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        padding: 10,
        callbacks: {
          title: (items) => `${Math.round(items[0].parsed.x)} m`,
          label: (item) =>
            ` ${item.dataset.label}: ${fmt ? fmt(item.parsed.y) : item.parsed.y.toFixed(1)}`,
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
        title: { display: showX, text: "Distance (m)", color: "#a0a0a0", font: { size: 11, family: "'Outfit', sans-serif" } },
      },
      y: {
        grid: zeroLine
          ? { color: (ctx) => (ctx.tick.value === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.04)") }
          : grid,
        ticks,
        title: { display: true, text: title, color: "#a0a0a0", font: { size: 11, family: "'Outfit', sans-serif" } },
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
