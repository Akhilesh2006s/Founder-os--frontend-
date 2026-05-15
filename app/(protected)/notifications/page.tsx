"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { notificationsFeedQueryKey, useNotificationsFeed } from "@/hooks/use-notifications-feed";
import { apiClient } from "@/lib/api-client";

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("Reminder");

  const feedQuery = useNotificationsFeed();

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: notificationsFeedQueryKey });

  const composeMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/notifications/compose", {
        title,
        message: "Test notification from FounderOS — you will also see this in the sidebar bell.",
        type: "System"
      }),
    onSuccess: invalidate
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: invalidate
  });

  const readAllMutation = useMutation({
    mutationFn: async () => apiClient.patch("/notifications/read-all"),
    onSuccess: invalidate
  });

  const items = feedQuery.data ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <PageShell
      title="Notifications"
      description="In-app alerts refresh every 45s · real events: task comments & completion, meeting invites, and tests below."
    >
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          className="rounded-lg bg-gold-cta px-4 py-2 text-sm font-semibold shadow-gold hover:brightness-110 disabled:opacity-50"
          type="button"
          disabled={composeMutation.isPending}
          onClick={() => composeMutation.mutate()}
        >
          Send test notification ({title})
        </button>
        <input
          className="rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm max-w-[220px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Test title"
        />
        {unreadCount > 0 && (
          <button
            type="button"
            className="rounded-lg border border-gold/30 px-4 py-2 text-sm disabled:opacity-50"
            disabled={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
          >
            Mark all read ({unreadCount})
          </button>
        )}
      </div>

      {feedQuery.isLoading && <p className="text-sm text-muted">Loading…</p>}
      {feedQuery.isError && (
        <p className="text-sm text-red-400">Could not load notifications · check login and API.</p>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <div
            key={n._id}
            className={`rounded-xl border px-4 py-3 flex flex-wrap justify-between gap-4 ${
              n.readAt ? "border-gold/20 opacity-75" : "border-gold/50 shadow-gold bg-gold/[0.04]"
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{n.title}</p>
                {n.type && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-gold/30 text-muted">
                    {n.type}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted whitespace-pre-wrap">{n.message}</p>
              {(n.createdAt || n.readAt) && (
                <p className="text-[11px] text-muted/70">
                  {formatWhen(n.createdAt)}
                  {n.readAt && <> · Read {formatWhen(n.readAt)}</>}
                </p>
              )}
              {n.type === "Task" && (
                <p className="pt-1">
                  <Link href="/action-items" className="text-xs text-gold-bright hover:underline">
                    Go to Action Management →
                  </Link>
                </p>
              )}
              {n.type === "Meeting" && (
                <p className="pt-1">
                  <Link href="/meetings" className="text-xs text-gold-bright hover:underline">
                    Go to Meetings →
                  </Link>
                </p>
              )}
            </div>
            {!n.readAt && (
              <button
                type="button"
                className="text-xs text-gold-bright self-start whitespace-nowrap"
                onClick={() => readMutation.mutate(n._id)}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
        {!items.length && !feedQuery.isLoading && (
          <p className="text-sm text-muted py-16 text-center">
            No notifications yet · add a comment on a shared task or send a test above.
          </p>
        )}
      </div>
    </PageShell>
  );
}
