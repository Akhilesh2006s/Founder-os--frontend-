"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormModal } from "@/components/ui/form-modal";
import { PageShell } from "@/components/page-shell";
import { toastApiError } from "@/components/ui/toast-handler";
import { apiClient } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import { formatInr } from "@/lib/format-inr";

const INVOICE_STATUSES = ["Pending", "Unpaid", "Paid", "Overdue"] as const;

/** Map legacy DB values to a selectable status in the dropdown. */
function statusForSelect(status: string) {
  if (status === "Partially Paid") return "Pending";
  if ((INVOICE_STATUSES as readonly string[]).includes(status)) return status;
  return "Pending";
}

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
  clientId: string;
  issueDate?: string;
  dueDate?: string;
  total: number;
  paidAmount: number;
  status: string;
  gstPercent?: number;
  items?: InvoiceLine[];
};

function toDateInput(iso?: string) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function clientIdFromInvoice(inv: InvoiceRow): string {
  const raw = inv.clientId as unknown;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "_id" in raw) return String((raw as { _id: string })._id);
  return "";
}

export default function FinancePage() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gstPercent, setGstPercent] = useState("0");
  const [lineDesc, setLineDesc] = useState("Professional services");
  const [rate, setRate] = useState("100");

  const [editInvoice, setEditInvoice] = useState<InvoiceRow | null>(null);
  const [editClientId, setEditClientId] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editGstPercent, setEditGstPercent] = useState("0");
  const [editLineDesc, setEditLineDesc] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editStatus, setEditStatus] = useState<string>("Pending");

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
    onSuccess: () => {
      void invalidate();
      appToast.success("Invoice created");
    },
    onError: (err) => toastApiError(err, "Could not create invoice")
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editInvoice) return;
      await apiClient.patch(`/finance/invoices/${editInvoice._id}`, {
        clientId: editClientId,
        issueDate: new Date(editIssueDate).toISOString(),
        dueDate: new Date(editDueDate).toISOString(),
        gstPercent: Number(editGstPercent),
        status: editStatus,
        items: [{ description: editLineDesc, quantity: 1, rate: Number(editRate) }]
      });
    },
    onSuccess: () => {
      void invalidate();
      setEditInvoice(null);
      appToast.success("Invoice updated");
    },
    onError: (err) => toastApiError(err, "Could not update invoice")
  });

  const patchStatusMutation = useMutation({
    mutationFn: async (payload: { invoiceId: string; status: string }) => {
      await apiClient.patch(`/finance/invoices/${payload.invoiceId}`, {
        status: payload.status
      });
    },
    onSuccess: () => {
      void invalidate();
      appToast.success("Status updated");
    },
    onError: (err) => toastApiError(err, "Could not update status")
  });

  const payMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const inv = invoicesQuery.data?.find((i) => i._id === invoiceId);
      const remaining = Math.max((inv?.total ?? 0) - (inv?.paidAmount ?? 0), 0);
      if (remaining <= 0) return;
      await apiClient.post(`/finance/invoices/${invoiceId}/payments`, {
        amount: remaining
      });
    },
    onSuccess: () => {
      void invalidate();
      appToast.success("Payment recorded");
    },
    onError: (err) => toastApiError(err, "Could not record payment")
  });

  function openEdit(inv: InvoiceRow) {
    const line = inv.items?.[0];
    setEditInvoice(inv);
    setEditClientId(clientIdFromInvoice(inv));
    setEditIssueDate(toDateInput(inv.issueDate));
    setEditDueDate(toDateInput(inv.dueDate));
    setEditGstPercent(String(inv.gstPercent ?? 0));
    setEditLineDesc(line?.description ?? "Professional services");
    setEditRate(String(line?.rate ?? 0));
    setEditStatus(statusForSelect(inv.status));
  }

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
            {createInvoiceMutation.isPending ? "Creating…" : "Create invoice"}
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
              <th className="p-3 min-w-[140px]">Actions</th>
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
                <td className="p-3">
                  <select
                    className="rounded-lg bg-surface-lift border border-gold/20 px-2 py-1 text-xs min-w-[7.5rem] disabled:opacity-50"
                    value={statusForSelect(inv.status)}
                    disabled={patchStatusMutation.isPending}
                    onChange={(e) =>
                      patchStatusMutation.mutate({ invoiceId: inv._id, status: e.target.value })
                    }
                  >
                    {INVOICE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {inv.status === "Partially Paid" && (
                      <option value="Partially Paid" disabled>
                        Partially Paid (legacy)
                      </option>
                    )}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-gold-bright hover:underline"
                      onClick={() => openEdit(inv)}
                    >
                      Edit
                    </button>
                    {inv.status !== "Paid" &&
                      (inv.paidAmount ?? 0) < (inv.total ?? 0) && (
                      <button
                        className="text-xs text-gold-bright hover:underline"
                        type="button"
                        disabled={payMutation.isPending}
                        onClick={() => payMutation.mutate(inv._id)}
                      >
                        Apply remaining
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoicesQuery.data?.length && (
          <p className="p-8 text-center text-sm text-muted">No invoices yet · convert CRM clients first.</p>
        )}
      </div>

      <FormModal
        open={Boolean(editInvoice)}
        title={editInvoice ? `Edit ${editInvoice.invoiceNumber}` : "Edit invoice"}
        size="lg"
        onClose={() => !updateInvoiceMutation.isPending && setEditInvoice(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gold/35 px-4 py-2 text-sm disabled:opacity-50"
              disabled={updateInvoiceMutation.isPending}
              onClick={() => setEditInvoice(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-gold-cta px-4 py-2 text-sm font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
              disabled={
                !editClientId ||
                !editLineDesc.trim() ||
                updateInvoiceMutation.isPending
              }
              onClick={() => updateInvoiceMutation.mutate()}
            >
              {updateInvoiceMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="text-xs text-muted grid gap-1">
            <span>Client</span>
            <select
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
              value={editClientId}
              onChange={(e) => setEditClientId(e.target.value)}
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
            <span>Status</span>
            <select
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-muted grid gap-1">
              <span>Issue date</span>
              <input
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
                type="date"
                value={editIssueDate}
                onChange={(e) => setEditIssueDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted grid gap-1">
              <span>Due date</span>
              <input
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted grid gap-1">
              <span>GST%</span>
              <input
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
                inputMode="decimal"
                value={editGstPercent}
                onChange={(e) => setEditGstPercent(e.target.value)}
              />
            </label>
          </div>
          <label className="text-xs text-muted grid gap-1">
            <span>Description</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
              value={editLineDesc}
              onChange={(e) => setEditLineDesc(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted grid gap-1">
            <span>Rate (₹)</span>
            <input
              className="rounded-lg bg-surface-lift px-3 py-2 text-sm w-full"
              inputMode="decimal"
              value={editRate}
              onChange={(e) => setEditRate(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-muted">
            You can change <span className="text-ink-secondary">Paid</span> back to{" "}
            <span className="text-ink-secondary">Unpaid</span> or{" "}
            <span className="text-ink-secondary">Pending</span> — recorded payment is cleared.{" "}
            <span className="text-ink-secondary">Paid</span> marks the full amount collected.
          </p>
        </div>
      </FormModal>
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
