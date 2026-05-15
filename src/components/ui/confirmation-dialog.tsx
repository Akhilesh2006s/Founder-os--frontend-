"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, primary button uses destructive styling */
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Accessible modal anchored to document.body — use for deletes and destructive flows.
 */
export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmationDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
        aria-label="Close dialog"
        onClick={() => !isLoading && onCancel()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-xl border border-gold/35 bg-surface-card p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      >
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p id={descId} className="mt-3 text-sm text-muted leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gold/35 px-4 py-2 text-sm text-ink-secondary hover:bg-surface-lift disabled:opacity-50"
            disabled={isLoading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-gold hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none ${
              destructive
                ? "bg-red-950/90 text-red-100 border border-red-800/70"
                : "bg-gold-cta text-black"
            }`}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
