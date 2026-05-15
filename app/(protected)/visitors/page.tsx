"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionDropdown } from "@/components/ui/action-dropdown";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { FormModal } from "@/components/ui/form-modal";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { toastApiError } from "@/components/ui/toast-handler";
import { appToast } from "@/lib/app-toast";

type Visitor = {
  _id: string;
  name: string;
  purpose: string;
  contact?: string;
  meetingRoom?: string;
  approvalStatus: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

export default function VisitorsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [contact, setContact] = useState("");
  const [meetingRoom, setMeetingRoom] = useState("");
  const [editVisitor, setEditVisitor] = useState<Visitor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["visitors"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: Visitor[] } }>("/visitors?limit=100&sortOrder=desc");
      return data.data.items;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/visitors", {
        name,
        purpose,
        contact: contact || undefined,
        meetingRoom: meetingRoom || undefined
      });
    },
    onSuccess: () => {
      setName("");
      setPurpose("");
      setContact("");
      setMeetingRoom("");
      void qc.invalidateQueries({ queryKey: ["visitors"] });
      appToast.success("Visitor registered");
    },
    onError: (err) => toastApiError(err, "Could not add visitor")
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      await apiClient.patch(`/visitors/${payload.id}`, payload.body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["visitors"] });
      appToast.success("Visitor updated");
    },
    onError: (err) => toastApiError(err, "Update failed — check roles or validation")
  });

  const putMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      await apiClient.put(`/visitors/${payload.id}`, payload.body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["visitors"] });
      setEditVisitor(null);
      appToast.success("Visitor saved");
    },
    onError: (err) => toastApiError(err, "Could not save changes")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/visitors/${id}`);
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["visitors"] });
      const prev = qc.getQueryData<Visitor[]>(["visitors"]);
      if (prev) qc.setQueryData(["visitors"], prev.filter((v) => v._id !== id));
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["visitors"], ctx.prev);
      toastApiError(err, "Delete failed — check permissions");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["visitors"] });
      setDeleteId(null);
      appToast.success("Visitor removed");
    }
  });

  const [editName, setEditName] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editMeetingRoom, setEditMeetingRoom] = useState("");

  function openEdit(v: Visitor) {
    setEditVisitor(v);
    setEditName(v.name);
    setEditPurpose(v.purpose);
    setEditContact(v.contact ?? "");
    setEditMeetingRoom(v.meetingRoom ?? "");
  }

  return (
    <PageShell
      title="Visitor management"
      description="Reception intake and approval workflow backed by /visitors."
    >
      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-2">
        <p className="text-sm text-ink-secondary">Register visitor</p>
        <div className="grid md:grid-cols-2 gap-2">
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Meeting room"
            value={meetingRoom}
            onChange={(e) => setMeetingRoom(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm disabled:opacity-50"
          disabled={!name || !purpose || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Add visitor"}
        </button>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gold/20 text-muted">
              <th className="p-3">Visitor</th>
              <th className="p-3">Purpose</th>
              <th className="p-3">Status</th>
              <th className="p-3">Checked in</th>
              <th className="p-3 w-52">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <LoadingSkeleton className="h-36 w-full" />
                </td>
              </tr>
            ) : null}
            {listQuery.data?.map((v) => (
              <tr key={v._id} className="border-b border-gold/15">
                <td className="p-3">
                  <p>{v.name}</p>
                  {v.contact && <p className="text-xs text-muted">{v.contact}</p>}
                  {v.meetingRoom && <p className="text-xs text-muted">Room {v.meetingRoom}</p>}
                </td>
                <td className="p-3 text-muted">{v.purpose}</td>
                <td className="p-3 text-xs">{v.approvalStatus}</td>
                <td className="p-3 text-xs text-muted">
                  {v.checkInAt ? new Date(v.checkInAt).toLocaleString() : "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <select
                      className="rounded bg-surface-lift px-2 py-1 text-xs max-w-[9rem]"
                      value={v.approvalStatus}
                      disabled={patchMutation.isPending}
                      onChange={(e) =>
                        patchMutation.mutate({ id: v._id, body: { approvalStatus: e.target.value } })
                      }
                    >
                      {["Pending", "Approved", "Rejected"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {!v.checkInAt ? (
                      <button
                        type="button"
                        className="text-gold-bright text-xs hover:underline text-left disabled:opacity-50"
                        disabled={patchMutation.isPending}
                        onClick={() =>
                          patchMutation.mutate({
                            id: v._id,
                            body: { checkInAt: new Date().toISOString() }
                          })
                        }
                      >
                        Check in
                      </button>
                    ) : null}
                    {v.checkInAt && !v.checkOutAt ? (
                      <button
                        type="button"
                        className="text-amber-400 text-xs hover:underline text-left disabled:opacity-50"
                        disabled={patchMutation.isPending}
                        onClick={() =>
                          patchMutation.mutate({
                            id: v._id,
                            body: { checkOutAt: new Date().toISOString() }
                          })
                        }
                      >
                        Check out
                      </button>
                    ) : null}
                    <ActionDropdown
                      triggerLabel="More"
                      ariaLabel="Visitor row actions"
                      triggerClassName="max-w-[10rem]"
                      items={[
                        {
                          id: "edit",
                          label: "Edit details",
                          onSelect: () => openEdit(v)
                        },
                        {
                          id: "delete",
                          label: "Delete visitor",
                          destructive: true,
                          onSelect: () => setDeleteId(v._id)
                        }
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listQuery.data?.length && !listQuery.isLoading && (
          <p className="text-sm text-muted p-6 text-center">No visitors logged.</p>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        title="Delete visitor?"
        message="This action cannot be undone. The visitor record will be permanently removed."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <FormModal
        open={Boolean(editVisitor)}
        title="Edit visitor"
        size="lg"
        onClose={() => !putMutation.isPending && setEditVisitor(null)}
        footer={
          <>
            <button
              type="button"
              className="rounded-lg border border-gold/40 px-4 py-2 text-sm disabled:opacity-50"
              disabled={putMutation.isPending}
              onClick={() => setEditVisitor(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-gold-cta px-5 py-2 text-sm font-semibold shadow-gold hover:brightness-110 disabled:opacity-50"
              disabled={
                putMutation.isPending ||
                editName.trim().length < 2 ||
                editPurpose.trim().length < 1 ||
                !editVisitor
              }
              onClick={() =>
                editVisitor &&
                putMutation.mutate({
                  id: editVisitor._id,
                  body: {
                    name: editName.trim(),
                    purpose: editPurpose.trim(),
                    contact: editContact.trim() || "",
                    meetingRoom: editMeetingRoom.trim() || ""
                  }
                })
              }
            >
              {putMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {editVisitor ? (
          <>
            <label className="block text-xs text-muted">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              Purpose
              <input
                className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm"
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              Contact
              <input
                className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              Meeting room
              <input
                className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm"
                value={editMeetingRoom}
                onChange={(e) => setEditMeetingRoom(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </FormModal>
    </PageShell>
  );
}
