"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { toastApiError } from "@/components/ui/toast-handler";
import { apiClient } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";

const TASK_STATUSES = [
  "Pending",
  "In Progress",
  "Blocked",
  "Completed",
  "Overdue",
  "Archived"
] as const;

type EmployeeSummary = {
  _id: string;
  name: string;
  department: string;
  role: string;
  email: string;
  activeCount: number;
  totalCount: number;
};

type AssignedItem = {
  task: {
    _id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    linkedProject?: string;
    dueDate?: string;
    updatedAt?: string;
  };
  clientId?: string;
  clientCompany?: string;
  projectName?: string;
  note?: string;
  reportDate?: string;
  assignedAt?: string;
};

function formatDay(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
}

function statusTone(status: string) {
  if (status === "Overdue") return "text-red-400 border-red-500/40 bg-red-950/30";
  if (status === "Completed" || status === "Archived")
    return "text-muted border-gold/20 bg-surface-lift";
  if (status === "In Progress") return "text-gold-bright border-gold/35 bg-gold/10";
  return "text-ink-secondary border-gold/20 bg-surface-lift";
}

export default function TeamTodoPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["employees", "todo-summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { employees: EmployeeSummary[] } }>(
        "/employees/todo-summary"
      );
      return data.data.employees;
    }
  });

  const employees = summaryQuery.data ?? [];

  useEffect(() => {
    if (!employees.length) return;
    if (!selectedId || !employees.some((e) => e._id === selectedId)) {
      setSelectedId(employees[0]._id);
    }
  }, [employees, selectedId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e._id === selectedId) ?? null,
    [employees, selectedId]
  );

  const workQuery = useQuery({
    queryKey: ["employees", selectedId, "assigned-work"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { employee: EmployeeSummary; items: AssignedItem[] };
      }>(`/employees/${selectedId}/assigned-work`);
      return data.data;
    },
    enabled: Boolean(selectedId)
  });

  const activeItems =
    workQuery.data?.items.filter(
      (i) => i.task.status !== "Completed" && i.task.status !== "Archived"
    ) ?? [];
  const doneItems =
    workQuery.data?.items.filter(
      (i) => i.task.status === "Completed" || i.task.status === "Archived"
    ) ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { taskId: string; status: string }) => {
      await apiClient.patch(`/tasks/${payload.taskId}/status`, { status: payload.status });
    },
    onMutate: (payload) => setUpdatingTaskId(payload.taskId),
    onSuccess: (_d, payload) => {
      void qc.invalidateQueries({ queryKey: ["employees", "todo-summary"] });
      if (selectedId) {
        void qc.invalidateQueries({ queryKey: ["employees", selectedId, "assigned-work"] });
      }
      void qc.invalidateQueries({ queryKey: ["clients"] });
      appToast.success(
        payload.status === "Completed" ? "Marked complete" : "Status updated"
      );
    },
    onError: (err) => toastApiError(err, "Could not update status"),
    onSettled: () => setUpdatingTaskId(null)
  });

  return (
    <PageShell
      title="Team todos"
      description="Work assigned from client portfolio notes. Pick an employee to see their tasks."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr] min-h-[calc(100vh-12rem)]">
        <aside className="rounded-xl border border-gold/20 bg-surface-card overflow-hidden flex flex-col min-h-[320px] lg:max-h-[calc(100vh-12rem)]">
          <div className="shrink-0 border-b border-gold/15 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Employees</p>
            <p className="text-[11px] text-muted/80 mt-0.5">Click a name to view assigned work</p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
            {summaryQuery.isLoading && (
              <p className="text-sm text-muted px-2 py-4">Loading team…</p>
            )}
            {summaryQuery.isError && (
              <p className="text-sm text-red-400 px-2 py-4">Could not load employees.</p>
            )}
            {!summaryQuery.isLoading &&
              employees.map((emp) => {
                const selected = selectedId === emp._id;
                return (
                  <button
                    key={emp._id}
                    type="button"
                    onClick={() => setSelectedId(emp._id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                      selected
                        ? "bg-gold/15 border border-gold/35 shadow-gold"
                        : "border border-transparent hover:bg-surface-lift"
                    }`}
                  >
                    <p className="text-sm font-medium text-ink truncate">{emp.name}</p>
                    <p className="text-[11px] text-muted truncate">
                      {emp.department} · {emp.role}
                    </p>
                    <p className="text-[11px] text-gold-bright/90 mt-1">
                      {emp.activeCount} active
                      {emp.totalCount !== emp.activeCount ? ` · ${emp.totalCount} total` : ""}
                    </p>
                  </button>
                );
              })}
            {!summaryQuery.isLoading && !employees.length && (
              <p className="text-sm text-muted px-2 py-4">No employees yet.</p>
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-gold/20 bg-surface-card p-4 min-h-[320px] overflow-y-auto scrollbar-hide">
          {!selectedId && (
            <div className="grid place-items-center min-h-[280px] text-center px-4">
              <p className="text-muted text-sm">Select an employee on the left to see assigned work.</p>
            </div>
          )}

          {selectedId && workQuery.isLoading && (
            <p className="text-sm text-muted">Loading assignments…</p>
          )}

          {selectedId && workQuery.isError && (
            <p className="text-sm text-red-400">Could not load assigned work.</p>
          )}

          {selectedEmployee && workQuery.data && (
            <div className="space-y-6">
              <header className="border-b border-gold/15 pb-4">
                <h2 className="text-xl font-semibold text-gold-bright">{selectedEmployee.name}</h2>
                <p className="text-sm text-muted mt-1">
                  {selectedEmployee.department} · {selectedEmployee.role} · {selectedEmployee.email}
                </p>
              </header>

              {!workQuery.data.items.length && (
                <p className="text-sm text-muted">No assigned work yet — use Assign on a client daily update.</p>
              )}

              {workQuery.data.items.length > 0 && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted mb-3">Active / in-flight</p>
                    {activeItems.length > 0 ? (
                      <ul className="space-y-3">
                        {activeItems.map((item) => (
                          <WorkCard
                            key={item.task._id}
                            item={item}
                            statusBusy={updatingTaskId === item.task._id}
                            onStatusChange={(taskId, status) =>
                              updateStatusMutation.mutate({ taskId, status })
                            }
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted/80">No active items for this person.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gold/90 mb-3">
                      Completed / archived
                    </p>
                    {doneItems.length > 0 ? (
                      <ul className="space-y-3">
                        {doneItems.map((item) => (
                          <WorkCard
                            key={item.task._id}
                            item={item}
                            statusBusy={updatingTaskId === item.task._id}
                            onStatusChange={(taskId, status) =>
                              updateStatusMutation.mutate({ taskId, status })
                            }
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted/80">
                        Nothing completed yet — use Mark complete or set status to Completed on an
                        active card above.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function WorkCard({
  item,
  onStatusChange,
  statusBusy
}: {
  item: AssignedItem;
  onStatusChange: (taskId: string, status: string) => void;
  statusBusy: boolean;
}) {
  const { task } = item;
  const isActive = task.status !== "Completed" && task.status !== "Archived";

  return (
    <li className="rounded-lg border border-gold/15 bg-surface-lift p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-ink">{task.title}</p>
        <span
          className={`text-[10px] uppercase tracking-wide rounded-full border px-2 py-0.5 ${statusTone(task.status)}`}
        >
          {task.status}
        </span>
      </div>
      {item.note && item.note !== task.title && (
        <p className="text-sm text-ink-secondary whitespace-pre-wrap">{item.note}</p>
      )}
      {task.description && task.description !== item.note && (
        <p className="text-xs text-muted whitespace-pre-wrap line-clamp-3">{task.description}</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {item.clientCompany && (
          <span>
            Client:{" "}
            {item.clientId ? (
              <Link href={`/clients/${item.clientId}`} className="text-gold-bright hover:underline">
                {item.clientCompany}
              </Link>
            ) : (
              item.clientCompany
            )}
          </span>
        )}
        {item.projectName && <span>Project: {item.projectName}</span>}
        {item.reportDate && <span>Note date: {formatDay(item.reportDate)}</span>}
        {item.assignedAt && <span>Assigned: {formatDay(item.assignedAt)}</span>}
        <span>Priority: {task.priority}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select
          className="rounded-lg bg-surface-card border border-gold/20 px-2 py-1.5 text-xs text-ink disabled:opacity-50"
          value={task.status}
          disabled={statusBusy}
          onChange={(e) => onStatusChange(task._id, e.target.value)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {isActive && task.status === "Pending" && (
          <button
            type="button"
            disabled={statusBusy}
            className="rounded-lg border border-gold/35 px-3 py-1.5 text-xs font-medium text-gold-bright hover:bg-gold/10 disabled:opacity-50"
            onClick={() => onStatusChange(task._id, "In Progress")}
          >
            Start
          </button>
        )}
        {isActive && (
          <button
            type="button"
            disabled={statusBusy}
            className="rounded-lg bg-gold-cta px-3 py-1.5 text-xs font-semibold text-black shadow-gold hover:brightness-110 disabled:opacity-50"
            onClick={() => onStatusChange(task._id, "Completed")}
          >
            {statusBusy ? "Saving…" : "Mark complete"}
          </button>
        )}
        <Link
          href="/action-items"
          className="ml-auto text-xs text-gold-bright hover:underline"
        >
          Open in Action Management →
        </Link>
      </div>
    </li>
  );
}
