"use client";

type LoadingSkeletonProps = {
  className?: string;
};

export function LoadingSkeleton({ className = "h-24" }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-gold/10 bg-surface-lift/40 ${className}`.trim()}
      aria-hidden
    />
  );
}
