"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { toastApiError } from "@/components/ui/toast-handler";
import { appToast } from "@/lib/app-toast";

const DOC_TYPES = ["Invoice", "Agreement", "Employee", "SOP", "Legal", "Meeting", "Bill", "Other"] as const;

type DocRow = {
  _id: string;
  name: string;
  url: string;
  type?: string;
  mimeType?: string;
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFile = useId();
  const [displayName, setDisplayName] = useState("");
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>("Other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const healthQuery = useQuery({
    queryKey: ["documents", "r2-health"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { r2Configured: boolean } }>("/documents/r2-health");
      return data.data;
    }
  });

  const docsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: DocRow[] } }>("/documents?limit=100");
      return data.data.items;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Choose a file first");
      const fd = new FormData();
      fd.append("file", selectedFile);
      if (displayName.trim().length >= 2) fd.append("name", displayName.trim());
      fd.append("type", docType);
      await apiClient.post("/documents/upload", fd);
    },
    onSuccess: () => {
      setSelectedFile(null);
      setDisplayName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["documents"] });
      appToast.success("File uploaded");
    },
    onError: (err) => toastApiError(err, "Upload failed — check backend and try again.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/documents/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
      setDeleteTarget(null);
      appToast.success("Document removed");
    },
    onError: (err) => toastApiError(err, "Could not delete file")
  });

  return (
    <PageShell
      title="Documents"
      description="Pick a file from your machine and upload — files are saved on the API server (see backend/uploads/documents)."
    >
      {healthQuery.data && (
        <p className="text-xs text-muted">
          Optional Cloudflare R2: {healthQuery.data.r2Configured ? "env configured" : "not set"} — uploads
          work locally without it.
        </p>
      )}

      <div className="rounded-xl border border-gold/20 bg-surface-card p-5 space-y-4">
        <p className="text-sm font-medium text-gold-bright">Upload file</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={idFile}
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setSelectedFile(f ?? null);
              if (f && displayName.trim().length < 2) {
                const base = f.name.replace(/\.[^/.]+$/, "");
                setDisplayName(base || f.name);
              }
            }}
          />
          <label
            htmlFor={idFile}
            className="cursor-pointer rounded-lg border border-gold/35 bg-surface-input px-4 py-2.5 text-sm text-gold-bright hover:border-gold/50 hover:bg-surface-lift"
          >
            Choose file…
          </label>
          <span className="text-sm text-muted truncate max-w-[min(420px,50vw)]">
            {selectedFile ? selectedFile.name : "No file chosen"}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs text-muted">
            Display name (optional — defaults to filename)
            <input
              className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm text-ink placeholder:text-muted/70"
              placeholder="Shown in list"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted">
            Category
            <select
              className="mt-1 w-full rounded-lg border border-gold/15 bg-surface-lift px-3 py-2 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="rounded-lg bg-gold-cta px-5 py-2.5 text-sm font-semibold shadow-gold hover:brightness-110 disabled:opacity-50"
          disabled={!selectedFile || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate()}
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload file"}
        </button>

        {uploadMutation.isError && (
          <p className="text-xs text-red-400">
            {(uploadMutation.error as Error)?.message || "Upload failed — check backend is running."}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {docsQuery.isLoading && (
          <div className="grid gap-2 sm:grid-cols-2">
            <LoadingSkeleton className="h-20 w-full" />
            <LoadingSkeleton className="h-20 w-full" />
          </div>
        )}
        {docsQuery.data?.map((d) => (
          <div
            key={d._id}
            className="rounded-lg border border-gold/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.name}</p>
              {(d.mimeType || d.type) && (
                <p className="text-[11px] text-muted mt-0.5">
                  {d.type ?? "Other"}
                  {d.mimeType ? ` · ${d.mimeType}` : ""}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <a
                className="text-gold-bright text-xs truncate hover:underline"
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
              </a>
              <button
                type="button"
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
                disabled={deleteMutation.isPending}
                aria-label={`Delete ${d.name}`}
                onClick={() => setDeleteTarget({ id: d._id, name: d.name })}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!docsQuery.data?.length && (
          <p className="text-sm text-muted py-10 text-center">No documents yet — upload above.</p>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Delete document?"
        message="This action cannot be undone. The file will be removed from storage and the catalog."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageShell>
  );
}
