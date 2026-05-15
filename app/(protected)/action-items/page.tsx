"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DragEvent, ReactElement } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { toastApiError } from "@/components/ui/toast-handler";
import { appToast } from "@/lib/app-toast";

type LinkedClientRef = string | { _id?: string; company?: string };

type ClientOption = { _id: string; company: string };

type TaskListItem = {
  _id: string;
  title: string;
  description?: string;
  type: "One-time" | "Daily" | "Weekly" | "Monthly" | "Recurring";
  status: string;
  priority: string;
  dueDate?: string;
  linkedProject?: string;
  linkedClientId?: LinkedClientRef;
};

type UserRef = { _id?: string; name?: string; email?: string };

type CommentRow = {
  _id: string;
  message: string;
  createdAt: string;
  userId?: UserRef | string;
};

type SubtaskRow = { _id: string; title: string; done: boolean };

type TaskDetail = TaskListItem & {
  subtasks: SubtaskRow[];
  comments: CommentRow[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: UserRef | string;
};

const statuses = ["Pending", "In Progress", "Blocked", "Completed", "Overdue", "Archived"] as const;

function labelForCommentAuthor(c: CommentRow) {
  const u = c.userId;
  if (u && typeof u === "object" && ("name" in u || "email" in u)) {
    return u.name ?? u.email ?? "Teammate";
  }
  return "Teammate";
}

function linkedClientKey(ref?: LinkedClientRef): string {
  if (!ref) return "";
  return typeof ref === "string" ? ref : String(ref._id ?? "");
}

function linkedClientCompany(ref?: LinkedClientRef): string {
  if (ref && typeof ref === "object" && ref.company) return ref.company;
  return "";
}

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekSun(d: Date): Date {
  const s = startOfCalendarDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function addDays(base: Date, delta: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + delta);
  return x;
}

function isoLocalNoonFromYmd(ymd: string): string {
  const [yStr, moStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(moStr);
  const day = Number(dStr);
  return new Date(y, m - 1, day, 12, 0, 0).toISOString();
}

function tasksDueOnCalendarDay(items: TaskListItem[], day: Date): TaskListItem[] {
  const y = day.getFullYear();
  const mo = day.getMonth();
  const dom = day.getDate();
  return items.filter((t) => {
    if (!t.dueDate) return false;
    const dt = new Date(t.dueDate);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === dom;
  });
}

function companyForTaskLinkedClient(task: TaskListItem, clients: ClientOption[]): string {
  const fromPop = linkedClientCompany(task.linkedClientId);
  if (fromPop) return fromPop;
  const id = linkedClientKey(task.linkedClientId);
  if (!id) return "";
  return clients.find((c) => c._id === id)?.company ?? "";
}

export default function ActionItemsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedProject, setLinkedProject] = useState("");
  const [linkedClientId, setLinkedClientId] = useState("");
  const [type, setType] = useState<TaskListItem["type"]>("One-time");
  const [priority, setPriority] = useState("Medium");
  const [view, setView] = useState<"table" | "kanban" | "calendar">("table");
  const [calendarMode, setCalendarMode] = useState<"month" | "week" | "day">("month");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [calCursor, setCalCursor] = useState(() => new Date());
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [taskPendingDeleteId, setTaskPendingDeleteId] = useState<string | null>(null);
  const [subtaskPendingDelete, setSubtaskPendingDelete] = useState<{ id: string; title: string } | null>(
    null
  );

  const tasksQuery = useQuery({
    queryKey: ["tasks", "action-list"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: TaskListItem[] } }>(
        "/tasks?limit=300&sortBy=dueDate&sortOrder=asc"
      );
      return data.data.items;
    }
  });

  const clientsQuery = useQuery({
    queryKey: ["sales", "clients", "picker"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: ClientOption[] } }>(
        "/sales/clients?limit=200"
      );
      return data.data.items;
    }
  });

  const detailQuery = useQuery({
    queryKey: ["tasks", selectedTaskId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TaskDetail }>(`/tasks/${selectedTaskId}`);
      return data.data;
    },
    enabled: Boolean(selectedTaskId)
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/tasks", {
        title,
        description: description || undefined,
        type,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        linkedProject: linkedProject || undefined,
        linkedClientId: linkedClientId || undefined
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      setLinkedProject("");
      setLinkedClientId("");
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
      appToast.success("Task created");
    },
    onError: (err) => toastApiError(err, "Could not create task")
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { taskId: string; status: string }) =>
      apiClient.patch(`/tasks/${payload.taskId}/status`, { status: payload.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
    }
  });

  const patchTaskMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      body: Partial<TaskListItem> & { linkedClientId?: string | null };
    }) => apiClient.patch(`/tasks/${payload.id}`, payload.body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["tasks", vars.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
      setEditOpen(false);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => apiClient.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      setSelectedTaskId(null);
      setTaskPendingDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
      appToast.success("Task removed");
    },
    onError: (err) => toastApiError(err, "Could not delete task")
  });

  const addCommentMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/tasks/${selectedTaskId}/comments`, { message: commentDraft }),
    onSuccess: () => {
      setCommentDraft("");
      void qc.invalidateQueries({ queryKey: ["tasks", selectedTaskId] });
    }
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/tasks/${selectedTaskId}/subtasks`, { title: subtaskDraft }),
    onSuccess: () => {
      setSubtaskDraft("");
      void qc.invalidateQueries({ queryKey: ["tasks", selectedTaskId] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
    }
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async (payload: { subtaskId: string; done: boolean }) =>
      apiClient.patch(`/tasks/${selectedTaskId}/subtasks/${payload.subtaskId}`, {
        done: payload.done
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", selectedTaskId] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
    }
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      if (!selectedTaskId) throw new Error("No task selected");
      return apiClient.delete(`/tasks/${selectedTaskId}/subtasks/${subtaskId}`);
    },
    onSuccess: () => {
      setSubtaskPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["tasks", selectedTaskId] });
      void qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
      appToast.success("Subtask removed");
    },
    onError: (err) => toastApiError(err, "Could not remove subtask")
  });

  const rescheduleDue = useCallback(
    (taskId: string, ymd: string) => {
      patchTaskMutation.mutate({ id: taskId, body: { dueDate: isoLocalNoonFromYmd(ymd) } });
    },
    [patchTaskMutation]
  );

  const groupedTasks = useMemo(() => {
    const items = tasksQuery.data ?? [];
    return statuses.map((status) => ({
      status,
      tasks: items.filter((task) => task.status === status)
    }));
  }, [tasksQuery.data]);

  const calYear = calCursor.getFullYear();
  const calMonth = calCursor.getMonth();
  const weekStartDate = useMemo(() => startOfWeekSun(calCursor), [calCursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)),
    [weekStartDate]
  );

  const monthBuckets = useMemo(() => {
    const buckets: Record<number, TaskListItem[]> = {};
    const items = tasksQuery.data ?? [];
    for (const t of items) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) continue;
      const dom = d.getDate();
      buckets[dom] = buckets[dom] ?? [];
      buckets[dom].push(t);
    }
    return buckets;
  }, [tasksQuery.data, calYear, calMonth]);

  const calGrid = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const pad = first.getDay();
    const dim = last.getDate();
    const cells: ReactElement[] = [];
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
    for (let i = 0; i < 7; i++) {
      cells.push(
        <div key={`h-${i}`} className="text-center text-[10px] text-muted/80 py-1">
          {dayLabels[i]}
        </div>
      );
    }
    for (let p = 0; p < pad; p++)
      cells.push(<div key={`pad-${p}`} className="min-h-[80px] rounded border border-transparent" />);

    const handleDropDay = (e: DragEvent, ymd: string) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/task-id");
      if (!id) return;
      rescheduleDue(id, ymd);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    for (let d = 1; d <= dim; d++) {
      const list = monthBuckets[d] ?? [];
      const ymd = toYmdLocal(new Date(calYear, calMonth, d));
      cells.push(
        <div
          key={d}
          role="presentation"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropDay(e, ymd)}
          className="min-h-[80px] rounded-lg border border-dashed border-gold/30 bg-surface p-1 overflow-hidden"
        >
          <p className="text-[11px] text-muted mb-1">{d}</p>
          <div className="flex flex-col gap-0.5">
            {list.slice(0, 4).map((t) => (
              <button
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/task-id", t._id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                key={t._id}
                type="button"
                title={t.title}
                className={`text-[10px] truncate rounded px-0.5 text-left cursor-grab active:cursor-grabbing ${
                  t.status === "Overdue"
                    ? "text-red-300 bg-red-950/40"
                    : "text-gold-bright/90 bg-surface-card"
                }`}
                onClick={() => setSelectedTaskId(t._id)}
              >
                {t.title}
              </button>
            ))}
            {list.length > 4 && (
              <span className="text-[10px] text-muted/80">+{list.length - 4}</span>
            )}
          </div>
        </div>
      );
    }
    return cells;
  }, [calMonth, calYear, monthBuckets, rescheduleDue]);

  const d = detailQuery.data;

  useEffect(() => {
    setEditOpen(false);
  }, [selectedTaskId]);

  return (
    <PageShell
      title="Action Management"
      description="Table, Kanban, and calendar (month, week, day) with drag‑drop reschedule · link tasks to clients for the Client hub."
    >
      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-8">
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm xl:col-span-2"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm min-h-[40px] xl:col-span-2 resize-y"
            placeholder="Description"
            rows={1}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input className="rounded-lg bg-surface-lift px-3 py-2 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Linked project"
            value={linkedProject}
            onChange={(e) => setLinkedProject(e.target.value)}
          />
          <select
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={linkedClientId}
            onChange={(e) => setLinkedClientId(e.target.value)}
          >
            <option value="">Linked client (optional)</option>
            {(clientsQuery.data ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.company}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as TaskListItem["type"])}
          >
            {(["One-time", "Daily", "Weekly", "Monthly", "Recurring"] as const).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="rounded-lg bg-surface-lift px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {(["Low", "Medium", "High", "Critical"] as const).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-3 py-2 text-sm disabled:opacity-60"
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["table", "kanban", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`px-3 py-1.5 text-xs rounded-md border capitalize ${
                view === v ? "bg-surface-lift border-gold/30" : "border-gold/20 text-muted"
              }`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "table" && (
        <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
          {(tasksQuery.data ?? []).map((task) => {
            const clientLabel = companyForTaskLinkedClient(task, clientsQuery.data ?? []);
            return (
            <div
              key={task._id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 py-2 last:border-0 cursor-pointer hover:bg-surface"
              role="presentation"
              onClick={() => setSelectedTaskId(task._id)}
            >
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted">
                  {task.type} · {task.priority}
                  {task.dueDate && <> · Due {new Date(task.dueDate).toLocaleDateString()}</>}
                  {task.linkedProject && <> · {task.linkedProject}</>}
                  {clientLabel && <> · {clientLabel}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-md bg-surface-lift px-2 py-1 text-xs"
                  value={task.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatusMutation.mutate({ taskId: task._id, status: e.target.value })}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-md border border-red-900 text-red-300 px-2 py-1 text-xs hover:bg-red-950/40 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaskPendingDeleteId(task._id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
          })}
          {!tasksQuery.data?.length && <p className="text-sm text-muted">No tasks yet.</p>}
        </div>
      )}

      {view === "kanban" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {groupedTasks.map((column) => (
            <div key={column.status} className="rounded-xl border border-gold/20 bg-surface-card p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">{column.status}</p>
              {column.tasks.map((task) => (
                <div
                  key={task._id}
                  role="presentation"
                  onClick={() => setSelectedTaskId(task._id)}
                  className="cursor-pointer rounded-lg border border-gold/20 bg-surface p-2 hover:border-gold/40"
                >
                  <p className="text-sm">{task.title}</p>
                  <p className="text-[11px] text-muted mt-1">
                    {task.priority} · {task.type}
                  </p>
                  <select
                    className="mt-2 w-full rounded-md bg-surface-lift px-2 py-1 text-[11px]"
                    value={task.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatusMutation.mutate({ taskId: task._id, status: e.target.value })}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {column.tasks.length === 0 && <p className="text-xs text-muted/80">No tasks</p>}
            </div>
          ))}
        </div>
      )}

      {view === "calendar" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["month", "week", "day"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md border capitalize ${
                  calendarMode === m ? "bg-surface-lift border-gold/30" : "border-gold/20 text-muted"
                }`}
                onClick={() => setCalendarMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {calendarMode === "month" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() =>
                    setCalCursor((c) => {
                      const n = new Date(c);
                      n.setMonth(n.getMonth() - 1);
                      return n;
                    })
                  }
                >
                  Previous
                </button>
                <p className="text-sm font-medium min-w-[180px]">
                  {calCursor.toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() =>
                    setCalCursor((c) => {
                      const n = new Date(c);
                      n.setMonth(n.getMonth() + 1);
                      return n;
                    })
                  }
                >
                  Next
                </button>
              </div>
              <div className="rounded-xl border border-gold/20 bg-surface-card p-2">
                <div className="grid grid-cols-7 gap-1">{calGrid}</div>
                <p className="mt-3 text-[11px] text-muted/80 px-2">
                  Drag a task onto another day to reschedule (due date). Week starts Sunday to match
                  the month grid.
                </p>
              </div>
            </>
          )}

          {calendarMode === "week" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() => setCalCursor((c) => addDays(c, -7))}
                >
                  Previous week
                </button>
                <p className="text-sm font-medium min-w-[220px]">
                  {weekStartDate.toLocaleDateString()} – {addDays(weekStartDate, 6).toLocaleDateString()}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() => setCalCursor((c) => addDays(c, 7))}
                >
                  Next week
                </button>
              </div>
              <div className="rounded-xl border border-gold/20 bg-surface-card p-2">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => {
                    const ymd = toYmdLocal(day);
                    const list = tasksDueOnCalendarDay(tasksQuery.data ?? [], day);
                    return (
                      <div
                        key={ymd}
                        role="presentation"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/task-id");
                          if (id) rescheduleDue(id, ymd);
                        }}
                        className="min-h-[140px] rounded-lg border border-dashed border-gold/30 bg-surface p-1 overflow-hidden"
                      >
                        <p className="text-[10px] text-muted">
                          {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {list.map((t) => (
                            <button
                              draggable
                              onDragStart={(ev) => {
                                ev.stopPropagation();
                                ev.dataTransfer.setData("text/task-id", t._id);
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              key={t._id}
                              type="button"
                              title={t.title}
                              className={`cursor-grab active:cursor-grabbing text-[10px] truncate rounded px-0.5 text-left ${
                                t.status === "Overdue"
                                  ? "text-red-300 bg-red-950/40"
                                  : "text-gold-bright/90 bg-surface-card"
                              }`}
                              onClick={() => setSelectedTaskId(t._id)}
                            >
                              {t.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-muted/80 px-2">Drop a task on a day to move its due date.</p>
              </div>
            </>
          )}

          {calendarMode === "day" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() => setCalCursor((c) => addDays(c, -1))}
                >
                  Previous day
                </button>
                <p className="text-sm font-medium min-w-[200px]">
                  {startOfCalendarDay(calCursor).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-gold/30 px-3 py-2 text-xs"
                  onClick={() => setCalCursor((c) => addDays(c, 1))}
                >
                  Next day
                </button>
              </div>
              <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
                {(() => {
                  const dayOnly = startOfCalendarDay(calCursor);
                  const ymd = toYmdLocal(dayOnly);
                  const list = tasksDueOnCalendarDay(tasksQuery.data ?? [], dayOnly);
                  return (
                    <div
                      role="presentation"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/task-id");
                        if (id) rescheduleDue(id, ymd);
                      }}
                      className="min-h-[200px] rounded-lg border border-dashed border-gold/30 bg-surface p-3"
                    >
                      <div className="flex flex-col gap-1">
                        {list.length ? (
                          list.map((t) => (
                            <button
                              draggable
                              onDragStart={(ev) => {
                                ev.stopPropagation();
                                ev.dataTransfer.setData("text/task-id", t._id);
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              key={t._id}
                              type="button"
                              className={`cursor-grab active:cursor-grabbing rounded-lg border border-gold/20 bg-surface-card px-3 py-2 text-left text-sm ${
                                t.status === "Overdue" ? "border-red-900/60" : ""
                              }`}
                              onClick={() => setSelectedTaskId(t._id)}
                            >
                              {t.title}
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-muted/80">No tasks due this day.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <p className="mt-3 text-[11px] text-muted/80">
                  Drag from week or month view here, or drop another task on this panel to set the
                  same due date.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {selectedTaskId && (
        <div className="fixed inset-x-0 bottom-0 top-auto z-50 max-h-[55vh] overflow-y-auto border-t border-gold/30 bg-surface p-4 shadow-2xl md:left-auto md:right-6 md:top-20 md:h-[calc(100vh-6rem)] md:max-h-none md:w-[400px] md:rounded-xl md:border md:shadow-xl">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <p className="text-xs text-muted">{d?.status}</p>
              <h3 className="text-lg font-semibold leading-snug">{d?.title ?? "…"}</h3>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <button
                type="button"
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
                onClick={() => d && setTaskPendingDeleteId(d._id)}
              >
                Delete
              </button>
              <button type="button" className="text-xs text-muted underline" onClick={() => setEditOpen((p) => !p)}>
                {editOpen ? "Close edit" : "Edit"}
              </button>
              <button type="button" className="text-xs text-muted" onClick={() => setSelectedTaskId(null)}>
                Close
              </button>
            </div>
          </div>

          {detailQuery.isLoading && <p className="text-sm text-muted">Loading task…</p>}
          {!detailQuery.isLoading && d && (
            <>
              {editOpen ? (
                <EditTaskInline
                  key={d._id}
                  task={d}
                  clients={clientsQuery.data ?? []}
                  onCancel={() => setEditOpen(false)}
                  isSaving={patchTaskMutation.isPending}
                  onSave={(body) =>
                    patchTaskMutation.mutate({
                      id: d._id,
                      body: {
                        ...body,
                        ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
                        ...(body.linkedClientId !== undefined
                          ? { linkedClientId: body.linkedClientId }
                          : {})
                      }
                    })
                  }
                />
              ) : (
                <>
                  <p className="text-sm text-ink-secondary whitespace-pre-wrap mb-3">{d.description || "No description"}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-muted mb-4">
                    <div>
                      <dt className="text-muted/80">Due</dt>
                      <dd>{d.dueDate ? new Date(d.dueDate).toLocaleString() : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted/80">Client</dt>
                      <dd className="text-ink-secondary flex flex-wrap items-center gap-2">
                        {(() => {
                          const cid = linkedClientKey(d.linkedClientId);
                          const lbl =
                            linkedClientCompany(d.linkedClientId) ||
                            companyForTaskLinkedClient(d, clientsQuery.data ?? []);
                          return cid || lbl ? (
                            <>
                              <span>{lbl || "Linked client"}</span>
                              {cid ? (
                                <Link
                                  href={`/clients/${cid}`}
                                  className="text-gold-bright hover:underline whitespace-nowrap"
                                >
                                  Open hub →
                                </Link>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          );
                        })()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted/80">Project</dt>
                      <dd>{d.linkedProject || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted/80">Updated</dt>
                      <dd>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : "—"}</dd>
                    </div>
                  </dl>
                  <div className="border-t border-gold/20 pt-3 mb-3">
                    <p className="text-xs uppercase text-muted mb-2">Comments</p>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto mb-2">
                      {(d.comments ?? []).length ? (
                        (d.comments ?? []).map((c) => (
                          <div key={c._id} className="rounded-lg bg-surface-card px-3 py-2">
                            <p className="text-[11px] text-muted">
                              {labelForCommentAuthor(c)} · {new Date(c.createdAt).toLocaleString()}
                            </p>
                            <p className="text-sm text-ink">{c.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted/80">No comments yet.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg bg-surface-lift px-3 py-2 text-sm"
                        placeholder="Add a comment"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!commentDraft.trim()}
                        className="rounded-lg bg-gold px-3 py-2 text-sm font-medium text-black shadow-gold hover:brightness-110 disabled:opacity-50"
                        onClick={() => addCommentMutation.mutate()}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-gold/20 pt-3 mb-6">
                    <p className="text-xs uppercase text-muted mb-2">Subtasks</p>
                    <div className="space-y-1 mb-2">
                      {(d.subtasks ?? []).map((st) => (
                        <div key={st._id} className="flex items-center gap-2 text-sm">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={st.done}
                              onChange={(e) =>
                                toggleSubtaskMutation.mutate({
                                  subtaskId: st._id,
                                  done: e.target.checked
                                })
                              }
                            />
                            <span className={st.done ? "line-through text-muted" : ""}>{st.title}</span>
                          </label>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] text-red-400/90 underline-offset-2 hover:underline disabled:opacity-50"
                            aria-label={`Remove subtask ${st.title}`}
                            disabled={deleteSubtaskMutation.isPending}
                            onClick={() => setSubtaskPendingDelete({ id: st._id, title: st.title })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg bg-surface-lift px-3 py-2 text-sm"
                        placeholder="New subtask"
                        value={subtaskDraft}
                        onChange={(e) => setSubtaskDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!subtaskDraft.trim()}
                        className="rounded-lg bg-surface-input px-3 py-2 text-sm text-white disabled:opacity-50"
                        onClick={() => addSubtaskMutation.mutate()}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(taskPendingDeleteId)}
        title="Delete Action Item?"
        message="This task will be permanently removed."
        destructive
        confirmLabel="Delete"
        isLoading={deleteTaskMutation.isPending}
        onCancel={() => !deleteTaskMutation.isPending && setTaskPendingDeleteId(null)}
        onConfirm={() => taskPendingDeleteId && deleteTaskMutation.mutate(taskPendingDeleteId)}
      />
      <ConfirmationDialog
        open={Boolean(subtaskPendingDelete)}
        title="Delete subtask?"
        message="This checklist item will be permanently removed."
        destructive
        confirmLabel="Delete"
        isLoading={deleteSubtaskMutation.isPending}
        onCancel={() => !deleteSubtaskMutation.isPending && setSubtaskPendingDelete(null)}
        onConfirm={() =>
          subtaskPendingDelete && deleteSubtaskMutation.mutate(subtaskPendingDelete.id)
        }
      />
    </PageShell>
  );
}

function EditTaskInline({
  task,
  clients,
  onCancel,
  onSave,
  isSaving
}: {
  task: TaskDetail;
  clients: ClientOption[];
  onCancel: () => void;
  onSave: (
    body: Partial<TaskListItem> & {
      description?: string;
      dueDate?: string | undefined;
      linkedClientId?: string;
    }
  ) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate?.slice?.(0, 10) ?? "");
  const [linkedProject, setLinkedProject] = useState(task.linkedProject ?? "");
  const [linkedClientSel, setLinkedClientSel] = useState(linkedClientKey(task.linkedClientId));
  const [priority, setPriority] = useState(task.priority);
  const [type, setType] = useState(task.type);

  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="text-xs text-muted">Title</span>
        <input className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs text-muted">Description</span>
        <textarea className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-muted">Due</span>
          <input className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Project</span>
          <input className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" value={linkedProject} onChange={(e) => setLinkedProject(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-muted">Linked client</span>
        <select
          className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2"
          value={linkedClientSel}
          onChange={(e) => setLinkedClientSel(e.target.value)}
        >
          <option value="">— None —</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.company}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-muted">Priority</span>
          <select className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {(["Low", "Medium", "High", "Critical"] as const).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Type</span>
          <select className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2" value={type} onChange={(e) => setType(e.target.value as TaskListItem["type"])}>
            {(["One-time", "Daily", "Weekly", "Monthly", "Recurring"] as const).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" className="flex-1 rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 disabled:opacity-50" disabled={isSaving} onClick={() => {
          onSave({
            title,
            description,
            linkedProject,
            linkedClientId: linkedClientSel || "",
            priority,
            type,
            dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
          });
        }}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="rounded-lg border border-gold/40 px-4 py-2" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
