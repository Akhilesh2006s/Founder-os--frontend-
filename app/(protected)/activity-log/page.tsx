"use client";

import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";

type LogRow = {
  _id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorLabel: string;
  createdAt?: string;
};

export default function ActivityLogPage() {
  const logsQuery = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { items: LogRow[]; total?: number };
      }>("/activity?limit=100&sortBy=createdAt&sortOrder=desc");
      return data.data.items ?? [];
    }
  });

  return (
    <PageShell
      title="Audit activity"
      description="Recent mutations across FounderOS entities. Restricted roles only."
    >
      {logsQuery.isError && (
        <p className="text-sm text-amber-500">
          Unable to load activity (you may lack access, or the API returned an error).
        </p>
      )}
      {logsQuery.isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gold/20 text-muted">
              <th className="p-3">When</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Id</th>
            </tr>
          </thead>
          <tbody>
            {logsQuery.data?.map((row) => (
              <tr key={row._id} className="border-b border-gold/15">
                <td className="p-3 whitespace-nowrap text-muted">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                </td>
                <td className="p-3 text-ink-secondary max-w-[200px] truncate">{row.actorLabel}</td>
                <td className="p-3 font-mono text-xs">{row.action}</td>
                <td className="p-3">{row.entityType}</td>
                <td className="p-3 font-mono text-xs text-muted truncate max-w-[120px]" title={row.entityId}>
                  {row.entityId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logsQuery.isLoading && !logsQuery.data?.length && (
          <p className="text-sm text-muted p-6 text-center">No activity rows yet.</p>
        )}
      </div>
    </PageShell>
  );
}
