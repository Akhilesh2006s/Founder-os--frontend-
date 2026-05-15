"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { toastApiError } from "@/components/ui/toast-handler";
import { appToast } from "@/lib/app-toast";

type Meeting = {
  _id: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string;
  startTime?: string;
  endTime?: string;
};

type SpawnedTaskRow = {
  _id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate?: string;
  linkedProject?: string;
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [meetingDeleteId, setMeetingDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: Meeting[] } }>("/meetings?limit=100&sortOrder=desc");
      return data.data.items;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/meetings", {
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        durationMinutes,
        notes
      });
    },
    onSuccess: () => {
      setTitle("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      void qc.invalidateQueries({ queryKey: ["calendar", "feed"] });
      appToast.success("Meeting scheduled");
    },
    onError: (err) => toastApiError(err, "Could not schedule meeting")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/meetings/${id}`);
    },
    onSuccess: () => {
      setMeetingDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      void qc.invalidateQueries({ queryKey: ["calendar", "feed"] });
      appToast.success("Meeting deleted");
    },
    onError: (err) => toastApiError(err, "Could not delete meeting")
  });

  const spawnTaskMutation = useMutation({
    mutationFn: async (payload: { meetingId: string; taskTitle: string }) => {
      const { data } = await apiClient.post<{ success: boolean; data: { task: SpawnedTaskRow } }>(
        `/meetings/${payload.meetingId}/tasks`,
        { title: payload.taskTitle }
      );
      return data;
    },
    onSuccess: async (body) => {
      const raw = body?.data?.task;
      if (raw?._id) {
        const row: SpawnedTaskRow = {
          _id: String(raw._id),
          title: String(raw.title ?? ""),
          status: String(raw.status ?? "Pending"),
          priority: String(raw.priority ?? "High"),
          type: String(raw.type ?? "One-time"),
          dueDate: typeof raw.dueDate === "string" ? raw.dueDate : undefined,
          linkedProject: typeof raw.linkedProject === "string" ? raw.linkedProject : undefined
        };
        qc.setQueryData(["tasks", "action-list"], (prev) => {
          const list = (prev as SpawnedTaskRow[] | undefined) ?? [];
          if (list.some((p) => p._id === row._id)) return prev;
          return [row, ...list] as typeof prev;
        });
      }
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      await qc.invalidateQueries({ queryKey: ["tasks", "action-list"] });
      await qc.refetchQueries({ queryKey: ["tasks", "action-list"] });
      appToast.success("Linked task created");
    },
    onError: (err) => toastApiError(err, "Could not create linked task")
  });

  return (
    <PageShell
      title="Meeting management"
      description="Schedule meetings and spawn linked action items."
    >
      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-3">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <label className="lg:col-span-2 block text-xs text-muted">
            Title
            <input
              className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted">
            Start time
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted">
            Duration (minutes)
            <input
              type="number"
              min={5}
              className="mt-1 w-full rounded-lg bg-surface-lift px-3 py-2 text-sm"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
            />
          </label>
        </div>
        <textarea
          className="w-full rounded-lg bg-surface-lift px-3 py-2 text-sm min-h-[72px]"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm disabled:opacity-50"
          disabled={!title || !scheduledAt || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Schedule"}
        </button>
      </div>

      <div className="space-y-4">
        {listQuery.data?.map((m) => {
          const mins = m.durationMinutes ?? 30;
          const startMs = Date.parse(m.startTime ?? m.scheduledAt);
          const safeStart = Number.isFinite(startMs) ? new Date(startMs) : new Date(m.scheduledAt);
          const endMs = m.endTime ? Date.parse(m.endTime) : safeStart.getTime() + mins * 60 * 1000;
          const end = Number.isFinite(endMs) ? new Date(endMs) : new Date(safeStart.getTime() + mins * 60 * 1000);
          return (
            <div key={m._id} className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted">
                    <span className="text-muted/80">Start:</span> {safeStart.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted">
                    <span className="text-muted/80">End:</span> {end.toLocaleString()}
                  </p>
                  <p className="text-xs font-medium text-gold-bright/90">Meeting Duration: {mins} mins</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-red-400 hover:underline disabled:opacity-50"
                    disabled={deleteMutation.isPending}
                    onClick={() => setMeetingDeleteId(m._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {m.notes && <p className="text-sm text-muted">{m.notes}</p>}
              <SpawnTaskInline
                disabled={spawnTaskMutation.isPending}
                onSpawn={(taskTitle) => spawnTaskMutation.mutate({ meetingId: m._id, taskTitle })}
              />
            </div>
          );
        })}
        {!listQuery.data?.length && !listQuery.isLoading && (
          <p className="text-sm text-muted">No meetings yet.</p>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(meetingDeleteId)}
        title="Delete meeting?"
        message="Scheduled notes and follow-ups stay in other modules; this meeting card will be removed."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setMeetingDeleteId(null)}
        onConfirm={() => meetingDeleteId && deleteMutation.mutate(meetingDeleteId)}
      />
    </PageShell>
  );
}

function SpawnTaskInline({
  disabled,
  onSpawn
}: {
  disabled: boolean;
  onSpawn: (title: string) => void;
}) {
  const [t, setT] = useState("");
  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-gold/20">
      <input
        className="flex-1 min-w-[200px] rounded-lg bg-surface px-3 py-2 text-sm"
        placeholder="Follow-up task title"
        value={t}
        onChange={(e) => setT(e.target.value)}
      />
      <button
        type="button"
        disabled={!t.trim() || disabled}
        className="rounded-lg border border-gold/30 px-3 py-2 text-xs disabled:opacity-50"
        onClick={() => {
          onSpawn(t.trim());
          setT("");
        }}
      >
        Create linked task
      </button>
    </div>
  );
}
