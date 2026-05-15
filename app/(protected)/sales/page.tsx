"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import { toastApiError } from "@/components/ui/toast-handler";
import { formatInr } from "@/lib/format-inr";

type Lead = {
  _id: string;
  company: string;
  contactPerson: string;
  stage: string;
  estimatedDealValue?: number;
  email?: string;
  phone?: string;
  source?: string;
  convertedClientId?: string | null;
};

type Client = {
  _id: string;
  company: string;
  contactPerson: string;
  dealValue?: number;
  paymentStatus?: string;
};

const PIPELINE = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost"
] as const;

function leadCanManualConvert(lead: Lead) {
  if (lead.convertedClientId) return false;
  if (lead.stage === "Lost") return false;
  return true;
}

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [company, setCompany] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [estimatedDealValue, setEstimatedDealValue] = useState("");
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [leadPendingDelete, setLeadPendingDelete] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());

  const leadsQuery = useQuery({
    queryKey: ["sales", "leads"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: Lead[] } }>(
        "/sales/leads?limit=200&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  const clientsQuery = useQuery({
    queryKey: ["sales", "clients"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: Client[] } }>(
        "/sales/clients?limit=200&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  const analyticsQuery = useQuery({
    queryKey: ["sales", "analytics"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: {
          funnel: Array<{ stage: string; count: number }>;
          conversionRate: number;
          wins: number;
          losses: number;
          lostReasons: Array<{ reason: string; count: number }>;
          revenueForecast: number;
          openDealCount: number;
          salesLeaderboard: Array<{ userId?: string; name: string; wins: number; revenue: number }>;
        };
      }>("/sales/analytics/summary");
      return data.data;
    }
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales", "leads"] }),
      queryClient.invalidateQueries({ queryKey: ["sales", "clients"] }),
      queryClient.invalidateQueries({ queryKey: ["sales", "analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    ]);

  const createLeadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/sales/leads", {
        company,
        contactPerson,
        email: email || undefined,
        estimatedDealValue: estimatedDealValue ? Number(estimatedDealValue) : undefined
      });
    },
    onSuccess: () => {
      void invalidate();
      setCompany("");
      setContactPerson("");
      setEmail("");
      setEstimatedDealValue("");
    }
  });

  const stageMutation = useMutation({
    mutationFn: async (payload: { id: string; stage: string; lostReason?: string }) => {
      await apiClient.patch(`/sales/leads/${payload.id}/stage`, {
        stage: payload.stage,
        lostReason: payload.lostReason
      });
    },
    onSuccess: () => void invalidate()
  });

  const convertMutation = useMutation({
    mutationFn: async (payload: { id: string; force?: boolean }) => {
      await apiClient.post(`/sales/leads/${payload.id}/convert`, {
        force: Boolean(payload.force)
      });
    },
    onSuccess: () => void invalidate()
  });

  const bulkConvertMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiClient.post(`/sales/leads/${id}/convert`, { force: true }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: ids.length - failed, failed };
    },
    onSuccess: (res) => {
      setSelectedLeadIds(new Set());
      void invalidate();
      if (res.failed === 0) {
        appToast.success(`${res.ok} lead(s) moved to Clients`);
      } else {
        appToast.success(`${res.ok} converted · ${res.failed} failed (e.g. lost or already converted)`);
      }
    },
    onError: (err) => toastApiError(err, "Bulk convert failed")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/sales/leads/${id}`);
    },
    onSuccess: () => {
      setLeadPendingDelete(null);
      void invalidate();
      appToast.success("Lead removed from pipeline");
    },
    onError: (err) => toastApiError(err, "Could not delete lead")
  });

  function patchLeadStage(leadId: string, nextStage: string) {
    if (nextStage === "Lost") {
      stageMutation.mutate({
        id: leadId,
        stage: nextStage,
        lostReason:
          lostReasonDraft.trim().length >= 2 ? lostReasonDraft : "No reason captured"
      });
    } else {
      stageMutation.mutate({ id: leadId, stage: nextStage });
    }
  }

  const columns = useMemo(() => {
    const items = leadsQuery.data ?? [];
    return PIPELINE.map((stage) => ({
      stage,
      leads: items.filter((l) => l.stage === stage)
    }));
  }, [leadsQuery.data]);

  const selectableLeadIds = useMemo(() => {
    const ids: string[] = [];
    for (const l of leadsQuery.data ?? []) {
      if (leadCanManualConvert(l)) ids.push(l._id);
    }
    return ids;
  }, [leadsQuery.data]);

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function selectAllConvertible() {
    setSelectedLeadIds(new Set(selectableLeadIds));
  }

  function clearLeadSelection() {
    setSelectedLeadIds(new Set());
  }

  return (
    <PageShell
      title="Sales CRM"
      description="Pipeline, analytics, manual bulk convert to Clients, and Negotiation workflow."
    >
      {analyticsQuery.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
            <p className="text-xs text-muted uppercase">Win rate (closed)</p>
            <p className="text-3xl font-semibold">{analyticsQuery.data.conversionRate}%</p>
            <p className="text-xs text-muted">
              {analyticsQuery.data.wins} won · {analyticsQuery.data.losses} lost
            </p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
            <p className="text-xs text-muted uppercase">Pipeline forecast</p>
            <p className="text-3xl font-semibold">
              {formatInr(analyticsQuery.data.revenueForecast)}
            </p>
            <p className="text-xs text-muted">{analyticsQuery.data.openDealCount} open deals</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs text-muted uppercase mb-2">Top closers</p>
            <div className="space-y-1 text-sm">
              {analyticsQuery.data.salesLeaderboard.slice(0, 5).map((row, idx) => (
                <div
                  key={row.userId ? String(row.userId) : `rep-${idx}`}
                  className="flex justify-between text-ink-secondary"
                >
                  <span>{row.name}</span>
                  <span className="text-muted">
                    {row.wins} wins · {formatInr(row.revenue)}
                  </span>
                </div>
              ))}
              {!analyticsQuery.data.salesLeaderboard.length && (
                <p className="text-xs text-muted/80">No closed deals yet.</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-3 rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs text-muted uppercase mb-3">Pipeline funnel</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {analyticsQuery.data.funnel.map((f) => {
                const max = Math.max(...analyticsQuery.data!.funnel.map((x) => x.count), 1);
                const pct = Math.round((f.count / max) * 100);
                return (
                  <div key={f.stage} className="rounded-lg bg-surface border border-gold/20 p-2">
                    <p className="text-[10px] text-muted leading-tight line-clamp-2">{f.stage}</p>
                    <p className="text-lg font-semibold">{f.count}</p>
                    <div className="mt-2 h-1.5 rounded bg-surface-lift overflow-hidden">
                      <div
                        className="h-full rounded bg-gradient-to-r from-gold-dim via-gold to-gold-bright transition-all opacity-95"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs text-muted uppercase mb-2">Lost reasons</p>
            <div className="flex flex-wrap gap-2">
              {analyticsQuery.data.lostReasons.map((r) => (
                <span key={r.reason} className="rounded-full bg-surface-lift px-3 py-1 text-xs text-ink-secondary">
                  {r.reason} · {r.count}
                </span>
              ))}
              {!analyticsQuery.data.lostReasons.length && (
                <span className="text-xs text-muted/80">No losses logged yet.</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gold/30 bg-surface-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-secondary">Manual push to Clients</p>
            <p className="text-xs text-muted mt-1 max-w-xl">
              Select any open lead (except Lost), then convert without waiting on Negotiation. Negotiation still
              supports one-click convert. Selection clears after a successful run.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{selectedLeadIds.size} selected</span>
            <button
              type="button"
              className="rounded-lg border border-gold/30 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-lift disabled:opacity-50"
              disabled={!selectableLeadIds.length}
              onClick={selectAllConvertible}
            >
              Select all eligible
            </button>
            <button
              type="button"
              className="rounded-lg border border-gold/30 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-lift disabled:opacity-50"
              disabled={!selectedLeadIds.size}
              onClick={clearLeadSelection}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-xs text-black disabled:opacity-50"
              disabled={!selectedLeadIds.size || bulkConvertMutation.isPending}
              onClick={() => bulkConvertMutation.mutate([...selectedLeadIds])}
            >
              {bulkConvertMutation.isPending ? "Converting…" : `Convert selected (${selectedLeadIds.size})`}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-3">
        <p className="text-sm font-medium text-ink-secondary">Create lead</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Contact person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            type="number"
            placeholder="Est. deal value (₹)"
            value={estimatedDealValue}
            onChange={(e) => setEstimatedDealValue(e.target.value)}
          />
        </div>
        <button
          className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm"
          disabled={!company || !contactPerson || createLeadMutation.isPending}
          onClick={() => createLeadMutation.mutate()}
        >
          Add lead
        </button>
        <div className="flex gap-3 items-center text-xs">
          <span className="text-muted">Lost reason (for Lost stage)</span>
          <input
            className="flex-1 rounded-lg bg-surface-lift px-3 py-2"
            placeholder="e.g. Price, timing, competitor"
            value={lostReasonDraft}
            onChange={(e) => setLostReasonDraft(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card p-3">
        <ScrollContainer horizontal ariaLabel="Sales pipeline kanban" className="max-w-full">
          <div className="flex h-[min(520px,calc(100dvh-14rem))] isolate gap-3 pr-1 pb-1 min-w-[1100px]">
          {columns.map((column) => (
            <div
              key={column.stage}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-gold/20 bg-surface p-3 min-h-0"
            >
              <div className="sticky top-0 z-10 shrink-0 flex items-center justify-between border-b border-gold/15 bg-surface pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{column.stage}</p>
                <span className="text-[11px] text-muted/80">{column.leads.length}</span>
              </div>
              <ScrollContainer
                ariaLabel={`${column.stage} — scroll column`}
                className="mt-2 min-h-0 flex-1 pr-1"
              >
                <div className="space-y-2">
                {column.leads.map((lead) => (
                  <div key={lead._id} className="rounded-lg border border-gold/20 bg-surface-card p-3 space-y-2">
                    <div className="flex gap-2 justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{lead.company}</p>
                        <p className="text-xs text-muted">{lead.contactPerson}</p>
                        {lead.estimatedDealValue != null && (
                          <p className="text-xs text-gold-bright mt-1">{formatInr(lead.estimatedDealValue)}</p>
                        )}
                      </div>
                      {leadCanManualConvert(lead) ? (
                        <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-gold rounded border-gold/40"
                            checked={selectedLeadIds.has(lead._id)}
                            onChange={() => toggleLeadSelection(lead._id)}
                          />
                          Sel.
                        </label>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-muted">Move stage</label>
                      <select
                        className="rounded bg-surface-lift px-2 py-1 text-xs"
                        value={lead.stage}
                        onChange={(e) => {
                          const nextStage = e.target.value;
                          if (nextStage === "Lost") {
                            stageMutation.mutate({
                              id: lead._id,
                              stage: nextStage,
                              lostReason:
                                lostReasonDraft.trim().length >= 2
                                  ? lostReasonDraft
                                  : "No reason captured"
                            });
                          } else {
                            stageMutation.mutate({ id: lead._id, stage: nextStage });
                          }
                        }}
                      >
                        {PIPELINE.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {lead.stage === "Negotiation" && !lead.convertedClientId && (
                        <button
                          type="button"
                          className="rounded bg-gold px-2 py-1 text-[11px] font-medium text-black hover:brightness-110 mt-1"
                          onClick={() => convertMutation.mutate({ id: lead._id })}
                        >
                          Convert to client
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-[11px] text-red-400 text-left mt-1 hover:underline disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                        onClick={() => setLeadPendingDelete(lead._id)}
                      >
                        Delete lead
                      </button>
                    </div>
                  </div>
                ))}
                {!column.leads.length && (
                  <p className="text-[11px] text-muted/80 text-center py-6">Drag cards here · empty</p>
                )}
                </div>
              </ScrollContainer>
            </div>
          ))}
          </div>
        </ScrollContainer>
      </div>

      <ScrollContainer ariaLabel="Leads by stage" className="max-h-[min(560px,calc(100dvh-10rem))] space-y-3 pr-1">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink-secondary">Leads by stage</p>
          <p className="text-xs text-muted">
            Same card + table styling as Clients below; one card per pipeline stage.
          </p>
          {!leadsQuery.isLoading && !(leadsQuery.data?.length ?? 0) ? (
            <p className="mt-2 text-xs text-muted/90">No leads yet · add one above.</p>
          ) : null}
        </div>
        {leadsQuery.isLoading ? (
          <p className="rounded-xl border border-gold/20 bg-surface-card p-8 text-center text-sm text-muted">
            Loading leads…
          </p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {columns.map(({ stage, leads: stageLeads }) => {
            const convertibleInStage = stageLeads.filter(leadCanManualConvert);
            const stageAllSelected =
              convertibleInStage.length > 0 &&
              convertibleInStage.every((l) => selectedLeadIds.has(l._id));

            function toggleStageSelect() {
              setSelectedLeadIds((prev) => {
                const next = new Set(prev);
                if (stageAllSelected) {
                  convertibleInStage.forEach((l) => next.delete(l._id));
                } else {
                  convertibleInStage.forEach((l) => next.add(l._id));
                }
                return next;
              });
            }

            return (
            <div
              key={stage}
              className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto"
            >
              <div className="p-4 border-b border-gold/20">
                <p className="text-sm font-medium text-ink-secondary">{stage}</p>
                <p className="text-xs text-muted">
                  {stageLeads.length === 0
                    ? "No leads in this stage."
                    : `${stageLeads.length} ${stageLeads.length === 1 ? "lead" : "leads"} · use checkboxes + Manual push, or convert from Negotiation.`}
                </p>
              </div>
              {stageLeads.length ? (
                <table className="w-full text-sm min-w-[360px]">
                  <thead>
                    <tr className="text-left border-b border-gold/20 text-muted">
                      <th className="p-3 w-10">
                        {convertibleInStage.length ? (
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-gold rounded border-gold/40"
                            title="Select all eligible in this stage"
                            checked={stageAllSelected}
                            onChange={toggleStageSelect}
                          />
                        ) : null}
                      </th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3 text-right">Deal value</th>
                      <th className="p-3">Move</th>
                      <th className="p-3 text-right text-xs font-normal">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageLeads.map((lead) => (
                      <tr key={lead._id} className="border-b border-gold/20 hover:bg-surface">
                        <td className="p-3 align-middle">
                          {leadCanManualConvert(lead) ? (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-gold rounded border-gold/40"
                              checked={selectedLeadIds.has(lead._id)}
                              onChange={() => toggleLeadSelection(lead._id)}
                              aria-label={`Select ${lead.company}`}
                            />
                          ) : (
                            <span className="text-[10px] text-muted/60">—</span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{lead.company}</td>
                        <td className="p-3 text-muted">{lead.contactPerson}</td>
                        <td className="p-3 text-right">
                          {lead.estimatedDealValue != null ? formatInr(lead.estimatedDealValue) : "—"}
                        </td>
                        <td className="p-3">
                          <select
                            className="w-full max-w-[10rem] rounded-lg bg-surface-lift px-2 py-1.5 text-xs"
                            value={lead.stage}
                            onChange={(e) => patchLeadStage(lead._id, e.target.value)}
                          >
                            {PIPELINE.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex flex-col items-end gap-2">
                            {lead.stage === "Negotiation" && !lead.convertedClientId ? (
                              <button
                                type="button"
                                className="rounded-lg bg-gold-cta px-2.5 py-1 text-xs font-semibold shadow-gold hover:brightness-110"
                                onClick={() => convertMutation.mutate({ id: lead._id })}
                                disabled={convertMutation.isPending}
                              >
                                Convert
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:underline"
                              onClick={() => setLeadPendingDelete(lead._id)}
                              disabled={deleteMutation.isPending}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-8 text-center text-sm text-muted">
                  No leads in this stage yet.
                </p>
              )}
            </div>
            );
          })}
        </div>
        )}

      </div>
      </ScrollContainer>

      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <div className="p-4 border-b border-gold/20">
          <p className="text-sm font-medium text-ink-secondary">Clients</p>
          <p className="text-xs text-muted">Converted accounts · use in Finance for invoicing.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gold/20 text-muted">
              <th className="p-3">Company</th>
              <th className="p-3">Contact</th>
              <th className="p-3 text-right">Deal value</th>
              <th className="p-3">Payment</th>
              <th className="p-3 text-right text-xs font-normal">Hub</th>
            </tr>
          </thead>
          <tbody>
            {clientsQuery.data?.map((c) => (
              <tr key={c._id} className="border-b border-gold/20 hover:bg-surface">
                <td className="p-3 font-medium">{c.company}</td>
                <td className="p-3 text-muted">{c.contactPerson}</td>
                <td className="p-3 text-right">{formatInr(c.dealValue ?? 0)}</td>
                <td className="p-3 text-xs">{c.paymentStatus ?? "—"}</td>
                <td className="p-3 text-right">
                  <Link href={`/clients/${c._id}`} className="text-xs text-gold-bright hover:underline">
                    Projects
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!clientsQuery.data?.length && (
          <p className="p-8 text-center text-sm text-muted">
            No clients yet · convert from Negotiation or use Manual push to Clients above.
          </p>
        )}
      </div>
      <ConfirmationDialog
        open={Boolean(leadPendingDelete)}
        title="Delete lead?"
        message="This lead will be removed from the active pipeline. Connected client records are not deleted."
        destructive
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setLeadPendingDelete(null)}
        onConfirm={() => leadPendingDelete && deleteMutation.mutate(leadPendingDelete)}
      />
    </PageShell>
  );
}
