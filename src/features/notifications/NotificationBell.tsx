"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notificationsFeedQueryKey, useNotificationsFeed } from "@/hooks/use-notifications-feed";
import { apiClient } from "@/lib/api-client";

function invalidateFeed(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: notificationsFeedQueryKey });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [panelNonce, setPanelNonce] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const feed = useNotificationsFeed();

  useEffect(() => {
    function handleDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
  }, []);

  const readOne = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => invalidateFeed(qc)
  });

  const readAll = useMutation({
    mutationFn: () => apiClient.patch("/notifications/read-all"),
    onSuccess: () => invalidateFeed(qc)
  });

  const items = feed.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const preview = items.slice(0, 8);

  const clampPanel = useCallback(() => {
    if (!open || !boundsRef.current || !buttonRef.current || !panelRef.current) return;

    const bounds = boundsRef.current.getBoundingClientRect();
    const br = buttonRef.current.getBoundingClientRect();
    const panel = panelRef.current;

    const margin = Math.max(12, 8);
    const maxW = Math.min(352, Math.max(bounds.width - margin * 2, 160));
    const maxPanelH = Math.min(
      bounds.height - margin * 2,
      Math.min(typeof window !== "undefined" ? window.innerHeight * 0.72 : 420, 420)
    );

    const relBtnRight = br.right - bounds.left;
    const relBtnTop = br.top - bounds.top;
    const relBtnBottom = br.bottom - bounds.top;

    let left = relBtnRight - maxW;
    left = Math.max(margin, Math.min(left, bounds.width - maxW - margin));

    let top = relBtnBottom + margin;
    if (top + maxPanelH > bounds.height - margin) {
      top = Math.max(margin, relBtnTop - maxPanelH - margin);
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${maxW}px`;
    panel.style.maxHeight = `${maxPanelH}px`;
  }, [open]);

  useLayoutEffect(() => {
    clampPanel();
  }, [clampPanel, preview.length, unread]);

  useEffect(() => {
    if (!open) return;
    const ro =
      typeof ResizeObserver !== "undefined" && boundsRef.current
        ? new ResizeObserver(() => clampPanel())
        : null;
    if (boundsRef.current && ro) ro.observe(boundsRef.current);
    window.addEventListener("resize", clampPanel);
    window.addEventListener("orientationchange", clampPanel);
    const id = window.requestAnimationFrame(() => clampPanel());
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", clampPanel);
      window.removeEventListener("orientationchange", clampPanel);
      window.cancelAnimationFrame(id);
    };
  }, [open, clampPanel, preview.length]);

  const layer =
    typeof document !== "undefined" ? (
      <AnimatePresence>
        {open ? (
          <div
            ref={boundsRef}
            className="pointer-events-none fixed z-[130] max-h-[100dvh] min-h-0 min-w-0 left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
            aria-hidden
          >
            <motion.div
              key={panelNonce}
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              drag
              dragConstraints={boundsRef}
              dragElastic={0}
              dragMomentum={false}
              className="pointer-events-auto absolute z-[140] flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-gold/30 bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.7)] md:max-w-[22rem]"
            >
              <div className="flex shrink-0 cursor-grab touch-none items-center justify-between gap-2 border-b border-gold/20 px-3 py-2 active:cursor-grabbing">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Alerts</p>
                {unread > 0 ? (
                  <button
                    type="button"
                    className="pointer-events-auto text-[11px] text-gold-bright hover:underline disabled:opacity-50"
                    disabled={readAll.isPending}
                    onClick={() => readAll.mutate()}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {preview.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-muted">No notifications yet.</p>
                )}
                {preview.map((n) => (
                  <div
                    key={n._id}
                    className={`border-b border-gold/10 px-3 py-2.5 last:border-0 ${
                      !n.readAt ? "bg-gold/[0.06]" : "opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{n.message}</p>
                        {n.type && (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-gold/70">{n.type}</p>
                        )}
                      </div>
                      {!n.readAt && (
                        <button
                          type="button"
                          className="shrink-0 text-[10px] text-gold-bright hover:underline"
                          onClick={() => readOne.mutate(n._id)}
                        >
                          Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 border-t border-gold/20 bg-surface-card px-2 py-2">
                <Link
                  href="/notifications"
                  className="block w-full rounded-lg py-2 text-center text-xs font-medium text-gold-bright outline-none ring-gold/40 transition-colors hover:bg-surface-lift focus-visible:ring-2"
                  onClick={() => setOpen(false)}
                >
                  Open notification center
                </Link>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    ) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) setPanelNonce((n) => n + 1);
            return next;
          });
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gold/25 bg-surface-card text-gold-bright transition-colors hover:bg-surface-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-gold px-1 py-0 text-center text-[10px] font-semibold leading-none text-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {layer && createPortal(layer, document.body)}
    </div>
  );
}
