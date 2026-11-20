import "server-only";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Server-side fetch of PUBLIC API data (landing page, catalog). No cookies are
 * sent. Returns null on 404 so pages can call notFound().
 */
export async function serverApi<T>(path: string): Promise<T | null> {
  try {
    // Public data changes rarely; refetch at most once a minute (admin edits show within 60s).
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

