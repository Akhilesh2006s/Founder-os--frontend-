"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { formatInr } from "@/lib/format-inr";

type ClientRow = {
  _id: string;
  company: string;
};

type InvoiceLine = {
  description: string;
  quantity: number;
  rate: number;
};

type InvoiceRow = {
  _id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  status: string;
  gstPercent?: number;
  items?: InvoiceLine[];
};

export default function FinancePage() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gstPercent, setGstPercent] = useState("0");
  const [lineDesc, setLineDesc] = useState("Professional services");
  const [rate, setRate] = useState("100");

  const summaryQuery = useQuery({
    queryKey: ["finance", "summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { outstanding: number; collected: number; totalInvoiced: number; overdueInvoiceCount: number };
      }>("/finance/summary");
      return data.data;
    }
  });

  const clientsQuery = useQuery({
    queryKey: ["sales", "clients", "minimal"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: ClientRow[] } }>("/sales/clients?limit=200");
      return data.data.items;
    }
  });

  const invoicesQuery = useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: InvoiceRow[] } }>(
        "/finance/invoices?limit=100&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["finance", "summary"] }),
      qc.invalidateQueries({ queryKey: ["finance", "invoices"] })
    ]);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/finance/invoices", {
        clientId,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        gstPercent: Number(gstPercent),
        items: [{ description: lineDesc, quantity: 1, rate: Number(rate) }]
      });
    },
    onSuccess: () => void invalidate()
  });

  const payMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const inv = invoicesQuery.data?.find((i) => i._id === invoiceId);
      const remaining = Math.max((inv?.total ?? 0) - (inv?.paidAmount ?? 0), 0);
      await apiClient.post(`/finance/invoices/${invoiceId}/payments`, {
        amount: remaining || 1
      });
    },
    onSuccess: () => void invalidate()
  });

  return (
    <PageShell title="Finance & invoices" description="Outstanding balance, invoicing with GST hints, payments, PDF blueprint endpoint.">
      {summaryQuery.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Outstanding" value={formatInr(summaryQuery.data.outstanding)} />
          <Metric label="Collected" value={formatInr(summaryQuery.data.collected)} />
          <Metric label="Total invoiced" value={formatInr(summaryQuery.data.totalInvoiced)} />
          <Metric label="Overdue" value={String(summaryQuery.data.overdueInvoiceCount)} />
        </div>
      )}

      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
        <p className="text-sm font-medium text-ink-secondary">New invoice</p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <label className="text-xs text-muted md:col-span-2 grid gap-1">
            <span>Client</span>
            <select
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Pick client…</option>
              {clientsQuery.data?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.company}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted grid gap-1">
            <span>Issue date</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted grid gap-1">
            <span>Due date</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted grid gap-1">
            <span>GST%</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              inputMode="decimal"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <label className="md:col-span-2 text-xs text-muted grid gap-1">
            <span>Description</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              value={lineDesc}
              onChange={(e) => setLineDesc(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted grid gap-1">
            <span>Rate (₹)</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <button
            className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm md:col-span-2"
            disabled={!clientId || createInvoiceMutation.isPending}
            onClick={() => createInvoiceMutation.mutate()}
          >
            Create invoice
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gold/30 text-muted">
              <th className="p-3">#</th>
              <th className="p-3 min-w-[220px]">GST% · Rate</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {invoicesQuery.data?.map((inv) => (
              <tr key={inv._id} className="border-b border-gold/20">
                <td className="p-3 font-mono">{inv.invoiceNumber}</td>
                <td className="p-3 text-xs align-top">
                  <p className="text-muted mb-2">
                    <span className="text-muted/80">GST%:</span> {inv.gstPercent ?? 0}
                  </p>
                  <div className="space-y-1 text-ink-secondary">
                    {(inv.items ?? []).map((ln, idx) => (
                      <div key={`${inv._id}-ln-${idx}`} className="leading-snug border-l border-gold/20 pl-2">
                        <p className="text-[11px] text-muted line-clamp-2">{ln.description}</p>
                        <p className="mt-0.5">
                          <span className="text-muted/80">Rate (₹):</span> {formatInr(ln.rate)}
                        </p>
                      </div>
                    ))}
                    {!inv.items?.length && <span className="text-muted">—</span>}
                  </div>
                </td>
                <td className="p-3">
                  {formatInr(inv.total)}{" "}
                  <span className="text-xs text-muted">(paid {formatInr(inv.paidAmount)})</span>
                </td>
                <td className="p-3">{inv.status}</td>
                <td className="p-3">
                  {inv.status !== "Paid" && (
                    <button
                      className="text-xs text-gold-bright underline"
                      type="button"
                      onClick={() => payMutation.mutate(inv._id)}
                    >
                      Apply remaining
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoicesQuery.data?.length && (
          <p className="p-8 text-center text-sm text-muted">No invoices yet · convert CRM clients first.</p>
        )}
      </div>
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4">
      <p className="text-[11px] uppercase text-muted">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
