import { headers } from "next/headers";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/**
 * Absolute base URL for server-side calls to this application's own route
 * handlers. Prefers an explicit public URL, otherwise derives it from the
 * incoming request headers.
 */
export async function serverBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const proto = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** GET a JSON endpoint, returning a typed result instead of throwing. */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const base = await serverBaseUrl();
    const response = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Request to ${path} failed with HTTP ${response.status}.`,
      };
    }
    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Network error" };
  }
}
