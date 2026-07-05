import { Line } from "react-chartjs-2";

// One telemetry channel (speed, throttle, ...) as a line chart.
// Reusable: App renders this once per channel with different props.
//
// Props:
//   title    — y-axis label, e.g. "Speed (km/h)"
//   points   — array of {x: distance, y: value}
//   color    — line color (driver's team color)
//   xMax     — lap length, so every chart spans the same x range
//   stepped  — true for gear/brake (jumps between values, no slope)
//   showX    — only the bottom chart shows the distance axis labels
//   height   — px height of this chart's box
function ChannelChart({ title, points, color, xMax, stepped = false, showX = false, height = 140 }) {
  const data = {
    datasets: [
      {
        label: title,
        data: points, // {x, y} pairs -> Chart.js plots on a real numeric axis
        borderColor: color,
        borderWidth: 1.6,
        pointRadius: 0,
        stepped,
      },
    ],
  };

  const grid = { color: "rgba(255,255,255,0.05)" };
  const ticks = { color: "#5c6472", font: { size: 11, family: "'JetBrains Mono', monospace" } };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // fill the fixed-height div instead of 2:1 default
    animation: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: {
        type: "linear", // real distance values, not evenly-spaced labels
        min: 0,
        max: xMax,
        grid,
        ticks: { ...ticks, display: showX },
        title: { display: showX, text: "Distance (m)", color: "#8b93a3", font: { size: 11 } },
      },
      y: {
        grid,
        ticks,
        title: { display: true, text: title, color: "#8b93a3", font: { size: 11 } },
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
