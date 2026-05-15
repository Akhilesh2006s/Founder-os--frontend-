"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";

const OP_TYPES = ["SOP", "Checklist", "Vendor", "Procurement", "Issue"] as const;
const OP_STATUSES = ["Pending", "In Progress", "Completed", "Blocked"] as const;

type OpRow = {
  _id: string;
  title: string;
  type: (typeof OP_TYPES)[number];
  status: (typeof OP_STATUSES)[number];
  dueDate?: string | null;
  details?: string;
};

export default function OperationsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof OP_TYPES)[number]>("SOP");
  const [details, setDetails] = useState("");

  const listQuery = useQuery({
    queryKey: ["operations"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: OpRow[] } }>("/operations?limit=100&sortOrder=desc");
      return data.data.items;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/operations", { title, type, details });
    },
    onSuccess: () => {
      setTitle("");
      setDetails("");
      void qc.invalidateQueries({ queryKey: ["operations"] });
    }
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      await apiClient.patch(`/operations/${payload.id}`, payload.body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["operations"] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/operations/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["operations"] })
  });

  return (
    <PageShell
      title="Operations workspace"
      description="Operational items backed by /operations (SOPs, vendors, checklists)."
    >
      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <input className="rounded-lg bg-surface-lift px-3 py-2 text-sm md:col-span-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="rounded-lg bg-surface-lift px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as (typeof OP_TYPES)[number])}>
            {OP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm min-h-[64px]"
          placeholder="Details / links"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm disabled:opacity-50"
          disabled={!title || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Create item"}
        </button>
      </div>

      <div className="space-y-2">
        {listQuery.data?.map((row) => (
          <div key={row._id} className="rounded-xl border border-gold/20 bg-surface-card p-4 flex flex-wrap gap-4 justify-between">
            <div className="min-w-0">
              <p className="font-medium">{row.title}</p>
              <p className="text-xs text-muted">
                {row.type} · {row.status}
              </p>
              {row.details && <p className="text-sm text-muted mt-2">{row.details}</p>}
            </div>
            <div className="flex flex-wrap gap-3 items-start">
              <select
                className="rounded-lg bg-surface-lift px-2 py-1 text-xs"
                value={row.status}
                onChange={(e) =>
                  patchMutation.mutate({ id: row._id, body: { status: e.target.value } })
                }
              >
                {OP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" className="text-xs text-red-400" onClick={() => deleteMutation.mutate(row._id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {!listQuery.data?.length && !listQuery.isLoading && (
          <p className="text-sm text-muted">Nothing in the backlog yet.</p>
        )}
      </div>
    </PageShell>
  );
}
