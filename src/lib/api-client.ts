import axios from "axios";

/** Railway production API (used when env is missing and host is not local). */
const DEFAULT_PRODUCTION_ORIGIN =
  "https://founder-os-backend-production-48a7.up.railway.app";

/** Backend mounts routes under `app.use("/api/v1", apiRouter)`. */
function normalizeApiBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/+$/, "") ?? "";
  if (!trimmed) return "";
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Resolve API base at runtime in the browser so Vercel previews work even if
 * `NEXT_PUBLIC_API_BASE_URL` was not set at build time (avoids relative `/auth/*` → 404 on the frontend host).
 */
function resolveBaseURL(): string {
  const explicit = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      return "http://localhost:5000/api/v1";
    }
    return normalizeApiBaseUrl(DEFAULT_PRODUCTION_ORIGIN);
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:5000/api/v1"
    : normalizeApiBaseUrl(DEFAULT_PRODUCTION_ORIGIN);
}

const baseURL = resolveBaseURL();

if (!baseURL) {
  console.warn(
    "[api-client] API base URL resolved empty — set NEXT_PUBLIC_API_BASE_URL in Vercel/deployment env."
  );
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true
});
