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
export const fetchDrivers = (year, round, session) =>
  getJSON(`/drivers?year=${year}&round=${round}&session=${session}`);
export async function fetchTelemetry(year, round, driver, session) {
  const path = `/telemetry?year=${year}&round=${round}&driver=${driver}&session=${session}`;
  try {
    return await getJSON(path);
  } catch (err) {
    // First-ever load of a race can outlive the proxy's ~100s window; the
    // server finishes caching it anyway, so one automatic retry after a
    // short pause usually succeeds without bothering the user.
    if (err.message !== "Failed to fetch") throw err;
    await new Promise((resolve) => setTimeout(resolve, 8000));
    return getJSON(path);
  }
}
