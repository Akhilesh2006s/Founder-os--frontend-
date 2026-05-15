"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";

type FeedEvent = {
  kind: "task" | "meeting" | "invoiceDue";
  id: string;
  startsAt: string;
  title: string;
  extra: Record<string, unknown>;
};

function monthBounds(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { from, to };
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const { from, to } = useMemo(() => monthBounds(cursor), [cursor]);

  const feedQuery = useQuery({
    queryKey: ["calendar", "feed", from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { events: FeedEvent[] } }>(
        `/calendar/feed?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      return data.data.events;
    }
  });

  const label = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <PageShell title="Calendar" description="Unified feed from tasks, meetings, and invoices due from /calendar/feed.">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
          onClick={() =>
            setCursor((c) => {
              const next = new Date(c);
              next.setMonth(next.getMonth() - 1);
              return next;
            })
          }
        >
          Prev
        </button>
        <p className="text-sm font-medium min-w-[160px] text-center">{label}</p>
        <button
          type="button"
          className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
          onClick={() =>
            setCursor((c) => {
              const next = new Date(c);
              next.setMonth(next.getMonth() + 1);
              return next;
            })
          }
        >
          Next
        </button>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
        <p className="text-xs text-muted">{from.slice(0, 10)} → {to.slice(0, 10)}</p>
        {feedQuery.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {feedQuery.data?.map((ev) => (
          <div key={`${ev.kind}-${ev.id}`} className="rounded-lg border border-gold/20 px-3 py-2 flex flex-wrap justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-gold mr-2">{ev.kind}</span>
              <span className="text-sm">{ev.title}</span>
            </div>
            <span className="text-xs text-muted whitespace-nowrap">
              {new Date(ev.startsAt).toLocaleString()}
            </span>
          </div>
        ))}
        {!feedQuery.isLoading && !feedQuery.data?.length && (
          <p className="text-sm text-muted">Nothing scheduled this month.</p>
        )}
      </div>
    </PageShell>
  );
}
