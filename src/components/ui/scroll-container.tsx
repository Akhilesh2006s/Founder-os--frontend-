"use client";

type ScrollContainerProps = {
  children: React.ReactNode;
  className?: string;
  /** When true, keeps horizontal scroll inside this region only */
  horizontal?: boolean;
  /** Optional label for screen readers */
  ariaLabel?: string;
};

/**
 * Isolated scroll region with sensible overflow — pair with flex parents using min-h-0.
 */
export function ScrollContainer({
  children,
  className = "",
  horizontal = false,
  ariaLabel
}: ScrollContainerProps) {
  const dir = horizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto overflow-x-hidden";
  return (
    <div
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      className={`min-h-0 overscroll-contain scroll-smooth ${dir} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
