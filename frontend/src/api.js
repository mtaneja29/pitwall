// One place for every backend call. VITE_API_URL (in .env.local) lets you
// point at a local server during development without touching code.
const API = import.meta.env.VITE_API_URL || "https://pitwall-9t5c.onrender.com";

async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

export const ping = () => getJSON("/");
export const fetchSchedule = (year) => getJSON(`/schedule?year=${year}`);
export const fetchDrivers = (year, round) => getJSON(`/drivers?year=${year}&round=${round}`);
export const fetchTelemetry = (year, round, driver) =>
  getJSON(`/telemetry?year=${year}&round=${round}&driver=${driver}`);
