"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type ActionDropdownItem = {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type ActionDropdownProps = {
  /** Visible trigger text */
  triggerLabel?: string;
  /** Screen reader label (defaults to trigger + “menu”) */
  ariaLabel?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  items: ActionDropdownItem[];
};

/**
 * Accessible action menu — click outside to close; matches FounderOS borders & surfaces.
 */
export function ActionDropdown({
  triggerLabel = "Actions",
  ariaLabel,
  items,
  align = "end",
  triggerClassName = ""
}: ActionDropdownProps) {
  const a11yLabel = ariaLabel ?? `${triggerLabel} menu`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnId = useId();
  const listId = `${btnId}-menu`;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open]);

  return (
    <div className={`relative inline-block text-left ${triggerClassName}`.trim()} ref={rootRef}>
      <button
        id={btnId}
        type="button"
        aria-label={a11yLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-surface-lift px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:border-gold/45 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          id={listId}
          role="menu"
          aria-labelledby={btnId}
          className={`absolute z-[200] mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-gold/35 bg-surface-card py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => (
            <button
              key={it.id}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              className={`block w-full px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
                it.destructive
                  ? "text-red-300 hover:bg-red-950/50"
                  : "text-ink-secondary hover:bg-surface-lift"
              }`}
              onClick={() => {
                if (!it.disabled) {
                  it.onSelect();
                  setOpen(false);
                }
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
