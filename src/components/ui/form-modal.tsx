"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type FormModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  /** Wider layout for multi-field forms */
  size?: "md" | "lg";
};

export function FormModal({ open, title, children, footer, onClose, size = "md" }: FormModalProps) {
  const id = useId();
  const titleId = `${id}-form-title`;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined" || !open) return null;

  const maxW = size === "lg" ? "max-w-lg" : "max-w-md";

  return createPortal(
    <div className="fixed inset-0 z-[255] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full ${maxW} max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto rounded-xl border border-gold/35 bg-surface-card p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)]`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-gold/25 px-2 py-1 text-xs text-muted hover:bg-surface-lift"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gold/15 pt-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
