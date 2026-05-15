"use client";

import { PageShell } from "@/components/page-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

type CompletedRow = {
  _id: string;
  title: string;
  updatedAt: string;
  status: string;
  priority?: string;
  type?: string;
};

export default function CompletedItemsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const completedQuery = useQuery({
    queryKey: ["tasks", "completed"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: CompletedRow[] } }>(
        "/tasks?status=Completed&limit=250&sortBy=updatedAt&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  const filtered = useMemo(() => {
    const rows = completedQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q));
  }, [completedQuery.data, search]);

  const stats = useMemo(() => {
    const rows = completedQuery.data ?? [];
    const pri = rows.reduce((acc, r) => {
      const k = r.priority ?? "Unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const lastWeek = rows.filter((r) => Date.now() - new Date(r.updatedAt).getTime() < 7 * 864e5).length;
    return { total: rows.length, lastWeek, byPriority: pri };
  }, [completedQuery.data]);

  const reopenMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiClient.patch(`/tasks/${taskId}/status`, { status: "Pending" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "completed"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "action-list"] });
    }
  });

  return (
    <PageShell
      title="Completed Items"
      description="Search completed work, skim priority mix, and reopen items into the backlog."
    >
      {completedQuery.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-[11px] uppercase text-muted">Total completed</p>
            <p className="text-2xl font-semibold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-[11px] uppercase text-muted">Completed (7 days)</p>
            <p className="text-2xl font-semibold mt-1">{stats.lastWeek}</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4 md:col-span-2">
            <p className="text-[11px] uppercase text-muted mb-2">Priority mix</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byPriority).map(([k, v]) => (
                <span key={k} className="rounded-full bg-surface-lift px-3 py-1 text-xs text-ink-secondary">
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gold/20 bg-surface-card p-3">
        <input
          type="search"
          className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
          placeholder="Filter by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
        {filtered.map((item) => (
          <div
            key={item._id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 py-2 last:border-0"
          >
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted">
                Completed {new Date(item.updatedAt).toLocaleString()}
                {item.priority ? ` · ${item.priority}` : ""}
                {item.type ? ` · ${item.type}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-gold/30 px-3 py-1 text-xs whitespace-nowrap"
              onClick={() => reopenMutation.mutate(item._id)}
              disabled={reopenMutation.isPending}
            >
              Reopen → Pending
            </button>
          </div>
        ))}
        {!filtered.length && completedQuery.data !== undefined && (
          <p className="text-sm text-muted text-center py-10">
            {search.trim() ? "No matches · clear search." : "No completed tasks found."}
          </p>
        )}
        {completedQuery.isLoading && <p className="text-sm text-muted text-center py-10">Loading…</p>}
      </div>
    </PageShell>
  );
}
