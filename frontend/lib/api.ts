export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = (j as any).detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}
