"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { formatInr } from "@/lib/format-inr";

type ClientRow = {
  _id: string;
  company: string;
  contactPerson: string;
  dealValue?: number;
  paymentStatus?: string;
};

export default function ClientsListPage() {
  const query = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: ClientRow[] } }>(
        "/sales/clients?limit=200&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  return (
    <PageShell
      title="Clients"
      description="Open a client hub to see portfolio projects and action items rolled up per project."
    >
      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gold/20 text-muted">
              <th className="p-3">Company</th>
              <th className="p-3">Contact</th>
              <th className="p-3 text-right">Deal value</th>
              <th className="p-3">Payment</th>
              <th className="p-3 w-[120px]" />
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((c) => (
              <tr key={c._id} className="border-b border-gold/20 hover:bg-surface">
                <td className="p-3 font-medium">{c.company}</td>
                <td className="p-3 text-muted">{c.contactPerson}</td>
                <td className="p-3 text-right">{formatInr(c.dealValue ?? 0)}</td>
                <td className="p-3 text-xs">{c.paymentStatus ?? "—"}</td>
                <td className="p-3">
                  <Link
                    href={`/clients/${c._id}`}
                    className="text-xs text-gold-bright hover:underline"
                  >
                    View hub →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.data?.length && !query.isLoading && (
          <p className="p-8 text-center text-sm text-muted">
            No clients yet · convert a lead from Negotiation on Sales CRM.
          </p>
        )}
        {query.isLoading && <p className="p-8 text-center text-sm text-muted">Loading…</p>}
      </div>
    </PageShell>
  );
}
