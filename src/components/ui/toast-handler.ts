"use client";

import { isAxiosError } from "axios";
import { appToast } from "@/lib/app-toast";

type ApiErrBody = { message?: string; success?: boolean };

/**
 * Centralized API error → Sonner toast (use in mutation onError).
 */
export function toastApiError(err: unknown, fallback = "Something went wrong") {
  if (isAxiosError(err)) {
    const body = err.response?.data as ApiErrBody | undefined;
    const msg = typeof body?.message === "string" ? body.message : err.message;
    appToast.error(msg && msg.length ? msg : fallback);
    return;
  }
  if (err instanceof Error && err.message) {
    appToast.error(err.message);
    return;
  }
  appToast.error(fallback);
}
