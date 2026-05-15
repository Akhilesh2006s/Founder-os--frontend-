import type { NextConfig } from "next";

/**
 * Ensure the browser bundle always knows the Railway API host, even when Vercel
 * "Environment Variables" does not define `NEXT_PUBLIC_API_BASE_URL` (avoids `/auth/*` → same-origin 404).
 * Dashboard env still overrides this at build time when set.
 */
const DEFAULT_PUBLIC_API_ORIGIN = "https://founder-os-backend-production-48a7.up.railway.app";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: (
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_PUBLIC_API_ORIGIN
    ).replace(/\/+$/, "")
  }
};

export default nextConfig;

