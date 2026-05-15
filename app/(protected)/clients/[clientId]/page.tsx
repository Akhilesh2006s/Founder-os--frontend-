"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PageShell } from "@/components/page-shell";
import { toastApiError } from "@/components/ui/toast-handler";
import { apiClient } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import { formatInr } from "@/lib/format-inr";

const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed"] as const;

type UpdateAssignment = {
  _id?: string;
  employeeId: string;
  employeeName: string;
  taskId?: string;
  assignedAt?: string;
};

type ProjectUpdate = {
  _id: string;
  note: string;
  reportDate?: string;
  createdAt?: string;
  assignments?: UpdateAssignment[];
};

type EmployeeRow = {
  _id: string;
  name: string;
  department: string;
  role: string;
};

type PortfolioProject = {
  _id?: string;
  name: string;
  status: string;
  description?: string;
  createdAt?: string;
  updates?: ProjectUpdate[];
};

type LeanTask = {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  linkedProject?: string;
  updatedAt?: string;
};

type ClientDoc = {
  _id: string;
  company: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  dealValue?: number;
  paymentStatus?: string;
  projectSummary?: string;
  supportStatus?: string;
};

type HubPayload = {
  client: ClientDoc;
  summary: {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
  };
  projects: {
    name: string;
    portfolio: PortfolioProject | null;
    activeWork: LeanTask[];
    completedWork: LeanTask[];
  }[];
};

function TaskChip({ task }: { task: LeanTask }) {
  return (
    <div
      className={`block w-full truncate rounded px-2 py-1 text-[11px] ${
        task.status === "Overdue"
          ? "bg-red-950/50 text-red-200"
          : "bg-surface-lift text-ink"
      }`}
      title={`${task.title} · ${task.status}`}
    >
      {task.title}
    </div>
  );
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function monthKeyFromIso(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    return "";
  }
}

function formatReportMonth(monthKey: string) {
  if (!monthKey) return "—";
  try {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long"
    });
  } catch {
    return monthKey;
  }
}

function formatReportDay(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}

/** ISO date string for a new update in the selected month (today if current month, else 1st). */
function reportDateForMonth(monthKey: string) {
  const now = new Date();
  const [y, m] = monthKey.split("-").map(Number);
  if (now.getFullYear() === y && now.getMonth() + 1 === m) {
    return now.toISOString().slice(0, 10);
  }
  return `${monthKey}-01`;
}

function EditProjectModal({
  open,
  initial,
  isLoading,
  onSave,
  onClose
}: {
  open: boolean;
  initial: { name: string; status: string; description: string } | null;
  isLoading: boolean;
  onSave: (payload: { name: string; status: string; description: string }) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("Active");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open || !initial) return;
    setName(initial.name);
    setStatus(initial.status);
    setDescription(initial.description);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined" || !open || !initial) return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !isLoading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="relative z-10 w-full max-w-lg rounded-xl border border-gold/35 bg-surface-card p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] space-y-4"
      >
        <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
          Edit portfolio project
        </h2>
        <div className="space-y-2">
          <input
            className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
          />
          <select
            className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm min-h-[88px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description / notes"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gold/35 px-4 py-2 text-sm disabled:opacity-50"
            disabled={isLoading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gold-cta px-4 py-2 text-sm font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
            disabled={isLoading || !name.trim()}
            onClick={() => onSave({ name: name.trim(), status, description })}
          >
            {isLoading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditUpdateModal({
  open,
  initial,
  isLoading,
  onSave,
  onClose
}: {
  open: boolean;
  initial: { note: string; reportDate: string } | null;
  isLoading: boolean;
  onSave: (payload: { note: string; reportDate: string }) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [reportMonth, setReportMonth] = useState("");

  useEffect(() => {
    if (!open || !initial) return;
    setNote(initial.note);
    setReportMonth(monthKeyFromIso(initial.reportDate) || currentMonthKey());
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined" || !open || !initial) return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !isLoading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-utitle`}
        className="relative z-10 w-full max-w-md rounded-xl border border-gold/35 bg-surface-card p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] space-y-4"
      >
        <h2 id={`${id}-utitle`} className="text-base font-semibold text-ink">
          Edit daily update
        </h2>
        <div className="space-y-2">
          <label className="text-[11px] text-muted">Month</label>
          <input
            type="month"
            className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
          />
          <label className="text-[11px] text-muted">Update</label>
          <textarea
            className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm min-h-[100px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened today?"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gold/35 px-4 py-2 text-sm disabled:opacity-50"
            disabled={isLoading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gold-cta px-4 py-2 text-sm font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
            disabled={isLoading || !note.trim()}
            onClick={() => onSave({ note: note.trim(), reportDate: reportDateForMonth(reportMonth) })}
          >
            {isLoading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AssignUpdateModal({
  open,
  notePreview,
  projectName,
  assignedEmployeeIds,
  employees,
  employeesLoading,
  assigningEmployeeId,
  onAssign,
  onClose
}: {
  open: boolean;
  notePreview: string;
  projectName: string;
  assignedEmployeeIds: string[];
  employees: EmployeeRow[];
  employeesLoading: boolean;
  assigningEmployeeId: string | null;
  onAssign: (employeeId: string, reassign: boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const hasAssignees = assignedEmployeeIds.length > 0;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !assigningEmployeeId) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, assigningEmployeeId]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !assigningEmployeeId && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-atitle`}
        className="relative z-10 flex w-full max-w-md max-h-[min(85vh,520px)] flex-col rounded-xl border border-gold/35 bg-surface-card shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      >
        <div className="shrink-0 border-b border-gold/20 p-5 space-y-2">
          <h2 id={`${id}-atitle`} className="text-base font-semibold text-ink">
            Assign work
          </h2>
          <p className="text-xs text-muted">
            Project: <span className="text-ink-secondary">{projectName}</span>
          </p>
          <p className="text-sm text-ink-secondary line-clamp-3">{notePreview}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide p-3 space-y-2">
          {employeesLoading && <p className="text-sm text-muted px-2 py-4">Loading team…</p>}
          {!employeesLoading && !employees.length && (
            <p className="text-sm text-muted px-2 py-4">No employees on file — add them under Employees first.</p>
          )}
          {employees.map((emp) => {
            const assigned = assignedEmployeeIds.includes(emp._id);
            const busy = assigningEmployeeId === emp._id;
            const reassign = hasAssignees && !assigned;
            return (
              <div
                key={emp._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gold/15 bg-surface-lift px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{emp.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {emp.department} · {emp.role}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={assigned || Boolean(assigningEmployeeId)}
                  className="shrink-0 rounded-lg bg-gold-cta px-3 py-1.5 text-xs font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
                  onClick={() => onAssign(emp._id, reassign)}
                >
                  {assigned
                    ? "Assigned"
                    : busy
                      ? reassign
                        ? "Reassigning…"
                        : "Assigning…"
                      : reassign
                        ? "Reassign"
                        : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-gold/20 p-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-gold/35 px-4 py-2 text-sm disabled:opacity-50"
            disabled={Boolean(assigningEmployeeId)}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ClientHubPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const qc = useQueryClient();

  const [projectName, setProjectName] = useState("");
  const [projectStatus, setProjectStatus] = useState<(typeof PROJECT_STATUSES)[number]>("Active");
  const [projectNotes, setProjectNotes] = useState("");
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { note: string; month: string }>>({});

  const [editProject, setEditProject] = useState<{
    projectId: string;
    name: string;
    status: string;
    description: string;
  } | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [editUpdate, setEditUpdate] = useState<{
    projectId: string;
    updateId: string;
    note: string;
    reportDate: string;
  } | null>(null);
  const [deleteUpdate, setDeleteUpdate] = useState<{ projectId: string; updateId: string } | null>(
    null
  );
  const [assignUpdate, setAssignUpdate] = useState<{
    projectId: string;
    updateId: string;
    note: string;
    projectName: string;
    assignedEmployeeIds: string[];
  } | null>(null);
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string | null>(null);

  const invalidateHub = () => {
    void qc.invalidateQueries({ queryKey: ["clients", "hub", clientId] });
    void qc.invalidateQueries({ queryKey: ["sales", "clients"] });
    void qc.invalidateQueries({ queryKey: ["clients", "list"] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const hubQuery = useQuery({
    queryKey: ["clients", "hub", clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: HubPayload }>(`/sales/clients/${clientId}/hub`);
      return data.data;
    },
    enabled: Boolean(clientId)
  });

  const addProjectMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/sales/clients/${clientId}/projects`, {
        name: projectName.trim(),
        status: projectStatus,
        description: projectNotes || undefined
      }),
    onSuccess: () => {
      setProjectName("");
      setProjectNotes("");
      invalidateHub();
    },
    onError: (err) => toastApiError(err, "Could not add project")
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (vars: { projectId: string; name: string; status: string; description: string }) => {
      await apiClient.patch(`/sales/clients/${clientId}/projects/${vars.projectId}`, {
        name: vars.name,
        status: vars.status,
        description: vars.description
      });
    },
    onSuccess: () => {
      setEditProject(null);
      invalidateHub();
      appToast.success("Project updated");
    },
    onError: (err) => toastApiError(err, "Could not update project")
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiClient.delete(`/sales/clients/${clientId}/projects/${projectId}`);
    },
    onSuccess: () => {
      setDeleteProjectId(null);
      invalidateHub();
      appToast.success("Project removed");
    },
    onError: (err) => toastApiError(err, "Could not delete project")
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (vars: { projectId: string; note: string; reportDate: string }) => {
      await apiClient.post(`/sales/clients/${clientId}/projects/${vars.projectId}/updates`, {
        note: vars.note,
        reportDate: vars.reportDate
      });
    },
    onSuccess: (_d, vars) => {
      setUpdateDrafts((d) => {
        const next = { ...d };
        delete next[vars.projectId];
        return next;
      });
      invalidateHub();
      appToast.success("Update logged");
    },
    onError: (err) => toastApiError(err, "Could not add update")
  });

  const patchUpdateMutation = useMutation({
    mutationFn: async (vars: {
      projectId: string;
      updateId: string;
      note: string;
      reportDate: string;
    }) => {
      await apiClient.patch(
        `/sales/clients/${clientId}/projects/${vars.projectId}/updates/${vars.updateId}`,
        { note: vars.note, reportDate: vars.reportDate }
      );
    },
    onSuccess: () => {
      setEditUpdate(null);
      invalidateHub();
      appToast.success("Update saved");
    },
    onError: (err) => toastApiError(err, "Could not save update")
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (vars: { projectId: string; updateId: string }) => {
      await apiClient.delete(
        `/sales/clients/${clientId}/projects/${vars.projectId}/updates/${vars.updateId}`
      );
    },
    onSuccess: () => {
      setDeleteUpdate(null);
      invalidateHub();
      appToast.success("Update removed");
    },
    onError: (err) => toastApiError(err, "Could not delete update")
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", "assign-picker"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: EmployeeRow[] } }>(
        "/employees?limit=200&sortBy=name&sortOrder=asc"
      );
      return data.data.items;
    },
    enabled: Boolean(assignUpdate)
  });

  const assignUpdateMutation = useMutation({
    mutationFn: async (vars: {
      projectId: string;
      updateId: string;
      employeeId: string;
      reassign: boolean;
    }) => {
      await apiClient.post(
        `/sales/clients/${clientId}/projects/${vars.projectId}/updates/${vars.updateId}/assign`,
        { employeeId: vars.employeeId, reassign: vars.reassign }
      );
    },
    onMutate: (vars) => {
      setAssigningEmployeeId(vars.employeeId);
    },
    onSuccess: (_d, vars) => {
      setAssignUpdate((prev) =>
        prev
          ? {
              ...prev,
              assignedEmployeeIds: vars.reassign
                ? [vars.employeeId]
                : [...prev.assignedEmployeeIds, vars.employeeId]
            }
          : null
      );
      invalidateHub();
      appToast.success(
        vars.reassign
          ? "Reassigned — task moved to the new owner"
          : "Assigned — task added to Action Management"
      );
    },
    onError: (err) => toastApiError(err, "Could not assign"),
    onSettled: () => setAssigningEmployeeId(null)
  });

  const h = hubQuery.data;

  return (
    <PageShell
      title={h?.client.company ?? "Client hub"}
      description="Portfolio projects with daily updates, task rollups, and edit/delete controls."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/clients" className="text-muted hover:text-white">
          ← All clients
        </Link>
        {h && (
          <span className="text-muted">
            {h.client.contactPerson}
            {h.client.email ? ` · ${h.client.email}` : ""}
          </span>
        )}
      </div>

      {hubQuery.isLoading && <p className="text-muted">Loading hub…</p>}
      {hubQuery.isError && (
        <p className="text-red-400">Could not load this client (permission or invalid id).</p>
      )}

      {h && (
        <>
          <div className="grid gap-3 sm:grid-cols-4 mb-6">
            {[
              { label: "Tasks (all)", value: h.summary.totalTasks },
              { label: "Active", value: h.summary.activeTasks },
              { label: "Completed / archived", value: h.summary.completedTasks },
              { label: "Deal", value: formatInr(h.client.dealValue ?? 0) }
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-1"
              >
                <p className="text-[11px] uppercase text-muted">{c.label}</p>
                <p className="text-2xl font-semibold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gold/20 bg-surface-card p-4 mb-8 space-y-3">
            <p className="text-sm font-medium text-ink">Record a portfolio project</p>
            <p className="text-xs text-muted">
              Link tasks to this name from Action Management (“Linked project”) and optionally tie
              tasks to this client (“Linked client”) to show them here. Only portfolio rows support
              daily updates and project edit/delete.
            </p>
            <div className="grid gap-2 md:grid-cols-4">
              <input
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm md:col-span-2"
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <select
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value as typeof projectStatus)}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
                placeholder="Notes"
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!projectName.trim() || addProjectMutation.isPending}
              className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm disabled:opacity-50"
              onClick={() => addProjectMutation.mutate()}
            >
              {addProjectMutation.isPending ? "Adding…" : "Add portfolio project"}
            </button>
            {addProjectMutation.isError && (
              <p className="text-xs text-red-400">Insufficient role or validation error.</p>
            )}
          </div>

          <div className="space-y-4">
            {h.projects.map((row) => {
              const pid = row.portfolio?._id;
              const defaultDraft = {
                note: "",
                month: currentMonthKey()
              };
              const draft = pid ? (updateDrafts[pid] ?? defaultDraft) : defaultDraft;

              const sortedUpdates = [...(row.portfolio?.updates ?? [])]
                .filter((u) => monthKeyFromIso(u.reportDate) === draft.month)
                .sort((a, b) => {
                  const ta = a.reportDate ? new Date(a.reportDate).getTime() : 0;
                  const tb = b.reportDate ? new Date(b.reportDate).getTime() : 0;
                  return tb - ta;
                });

              return (
                <section
                  key={row.name}
                  className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-4"
                >
                  <header className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{row.name}</h2>
                      {row.portfolio && (
                        <p className="text-xs text-muted mt-1">
                          Portfolio status:{" "}
                          <span className="text-ink-secondary">{row.portfolio.status}</span>
                          {row.portfolio.description ? ` · ${row.portfolio.description}` : ""}
                        </p>
                      )}
                      {!row.portfolio && (
                        <p className="text-xs text-amber-500/90 mt-1">
                          Not in portfolio list · add above or rename to match Linked project text.
                        </p>
                      )}
                    </div>
                    {pid ? (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          className="rounded-lg border border-gold/30 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-lift"
                          onClick={() =>
                            setEditProject({
                              projectId: pid,
                              name: row.portfolio!.name,
                              status: row.portfolio!.status,
                              description: row.portfolio!.description ?? ""
                            })
                          }
                        >
                          Edit project
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40"
                          onClick={() => setDeleteProjectId(pid)}
                        >
                          Delete project
                        </button>
                      </div>
                    ) : null}
                  </header>

                  {pid ? (
                    <div className="rounded-lg border border-gold/15 bg-surface p-3 space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Daily updates
                      </p>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted">Month</span>
                          <input
                            type="month"
                            className="rounded-lg bg-surface-lift px-2 py-1.5 text-xs"
                            value={draft.month}
                            onChange={(e) =>
                              setUpdateDrafts((prev) => ({
                                ...prev,
                                [pid]: { ...draft, month: e.target.value }
                              }))
                            }
                          />
                        </div>
                        <input
                          className="flex-1 min-w-[12rem] rounded-lg bg-surface-lift px-3 py-2 text-sm"
                          placeholder="Today’s note (stand-up, blockers, shipped work…)"
                          value={draft.note}
                          onChange={(e) =>
                            setUpdateDrafts((prev) => ({
                              ...prev,
                              [pid]: { ...draft, note: e.target.value }
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={!draft.note.trim() || addUpdateMutation.isPending}
                          className="rounded-lg bg-gold-cta px-3 py-2 text-xs font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
                          onClick={() =>
                            addUpdateMutation.mutate({
                              projectId: pid,
                              note: draft.note.trim(),
                              reportDate: reportDateForMonth(draft.month)
                            })
                          }
                        >
                          {addUpdateMutation.isPending ? "Saving…" : "Add update"}
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {sortedUpdates.map((u) => (
                          <li
                            key={u._id}
                            className="flex flex-wrap gap-2 items-start justify-between rounded-md border border-gold/10 bg-surface-card px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-muted mb-0.5">
                                {formatReportDay(u.reportDate)}
                              </p>
                              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{u.note}</p>
                              {(u.assignments?.length ?? 0) > 0 && (
                                <p className="text-[11px] text-muted mt-1.5">
                                  Assigned:{" "}
                                  <span className="text-ink-secondary">
                                    {u.assignments!.map((a) => a.employeeName).join(", ")}
                                  </span>
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                              <button
                                type="button"
                                className="text-xs text-gold-bright hover:underline"
                                onClick={() =>
                                  setAssignUpdate({
                                    projectId: pid,
                                    updateId: u._id,
                                    note: u.note,
                                    projectName: row.name,
                                    assignedEmployeeIds: (u.assignments ?? []).map((a) =>
                                      String(a.employeeId)
                                    )
                                  })
                                }
                              >
                                {(u.assignments?.length ?? 0) > 0 ? "Reassign" : "Assign"}
                              </button>
                              <button
                                type="button"
                                className="text-xs text-gold-bright hover:underline"
                                onClick={() =>
                                  setEditUpdate({
                                    projectId: pid,
                                    updateId: u._id,
                                    note: u.note,
                                    reportDate: u.reportDate
                                      ? new Date(u.reportDate).toISOString()
                                      : new Date().toISOString()
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-xs text-red-400 hover:underline"
                                onClick={() => setDeleteUpdate({ projectId: pid, updateId: u._id })}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                        {!sortedUpdates.length && (
                          <li className="text-xs text-muted/80">
                            No updates in {formatReportMonth(draft.month)} — log the first one above.
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted mb-2">
                        Active / in-flight
                      </p>
                      <div className="space-y-1 min-h-[2rem]">
                        {row.activeWork.length ? (
                          row.activeWork.map((t) => (
                            <TaskChip key={t._id} task={t} />
                          ))
                        ) : (
                          <p className="text-xs text-muted/80">No open items.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gold/90 mb-2">
                        Completed & archived (what we’ve done)
                      </p>
                      <div className="space-y-1 min-h-[2rem]">
                        {row.completedWork.length ? (
                          row.completedWork.map((t) => (
                            <TaskChip key={t._id} task={t} />
                          ))
                        ) : (
                          <p className="text-xs text-muted/80">Nothing shipped here yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {!h.projects.length && (
              <p className="text-sm text-muted">
                No projects yet — add a portfolio project or create tasks linked to this client with
                a “Linked project” name.
              </p>
            )}
          </div>
        </>
      )}

      <EditProjectModal
        open={Boolean(editProject)}
        initial={
          editProject
            ? { name: editProject.name, status: editProject.status, description: editProject.description }
            : null
        }
        isLoading={updateProjectMutation.isPending}
        onClose={() => !updateProjectMutation.isPending && setEditProject(null)}
        onSave={(payload) =>
          editProject &&
          updateProjectMutation.mutate({
            projectId: editProject.projectId,
            ...payload
          })
        }
      />

      <EditUpdateModal
        open={Boolean(editUpdate)}
        initial={
          editUpdate ? { note: editUpdate.note, reportDate: editUpdate.reportDate } : null
        }
        isLoading={patchUpdateMutation.isPending}
        onClose={() => !patchUpdateMutation.isPending && setEditUpdate(null)}
        onSave={(payload) =>
          editUpdate &&
          patchUpdateMutation.mutate({
            projectId: editUpdate.projectId,
            updateId: editUpdate.updateId,
            note: payload.note,
            reportDate: payload.reportDate
          })
        }
      />

      <AssignUpdateModal
        open={Boolean(assignUpdate)}
        notePreview={assignUpdate?.note ?? ""}
        projectName={assignUpdate?.projectName ?? ""}
        assignedEmployeeIds={assignUpdate?.assignedEmployeeIds ?? []}
        employees={employeesQuery.data ?? []}
        employeesLoading={employeesQuery.isLoading}
        assigningEmployeeId={assigningEmployeeId}
        onClose={() => !assigningEmployeeId && setAssignUpdate(null)}
        onAssign={(employeeId, reassign) =>
          assignUpdate &&
          assignUpdateMutation.mutate({
            projectId: assignUpdate.projectId,
            updateId: assignUpdate.updateId,
            employeeId,
            reassign
          })
        }
      />

      <ConfirmationDialog
        open={Boolean(deleteProjectId)}
        title="Delete portfolio project?"
        message="Tasks linked to this project name are not deleted — only the portfolio row is removed."
        destructive
        confirmLabel="Delete"
        isLoading={deleteProjectMutation.isPending}
        onCancel={() => !deleteProjectMutation.isPending && setDeleteProjectId(null)}
        onConfirm={() => deleteProjectId && deleteProjectMutation.mutate(deleteProjectId)}
      />

      <ConfirmationDialog
        open={Boolean(deleteUpdate)}
        title="Delete this update?"
        message="This daily log entry will be permanently removed. Linked assign tasks are removed too."
        destructive
        confirmLabel="Delete"
        isLoading={deleteUpdateMutation.isPending}
        onCancel={() => !deleteUpdateMutation.isPending && setDeleteUpdate(null)}
        onConfirm={() =>
          deleteUpdate && deleteUpdateMutation.mutate(deleteUpdate)
        }
      />
    </PageShell>
  );
}
