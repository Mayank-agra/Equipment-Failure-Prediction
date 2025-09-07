// src/api.js
const API_BASE = "http://localhost:5000";

// Call backend for a single device prediction
export async function predictSingle(device) {
  const body = { device };

  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  return res.json();
}
