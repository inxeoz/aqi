export function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function postAnalyze(payload: unknown) {
  const res = await fetch(backendUrl() + "/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("backend http " + res.status);
  return res.json();
}

export async function postDocument(payload: unknown) {
  const res = await fetch(backendUrl() + "/api/document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("backend http " + res.status);
  return res.json();
}
