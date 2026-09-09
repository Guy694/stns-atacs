import type { ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

type StatusBadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "border-[var(--state-success-border)] bg-[var(--state-success-bg)] text-[var(--state-success-fg)]",
  warning: "border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)]",
  danger: "border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)]",
  info: "border-[var(--state-info-border)] bg-[var(--state-info-bg)] text-[var(--state-info-fg)]",
  neutral: "border-[var(--state-neutral-border)] bg-[var(--state-neutral-bg)] text-[var(--state-neutral-fg)]",
  primary: "border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] text-[var(--primary-text)]",
};

export function StatusBadge({ tone = "neutral", children, className = "" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function activeTone(active: boolean): BadgeTone {
  return active ? "success" : "neutral";
}
