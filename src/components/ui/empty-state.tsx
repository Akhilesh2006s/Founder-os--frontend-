"use client";

import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Optional call-to-action aligned with design system */
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-gold/15 bg-surface-card/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {description ? <p className="mt-2 text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
