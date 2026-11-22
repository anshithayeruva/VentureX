import React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * Small shared building blocks for the signed-in workspaces.
 * Calm & minimal: white cards with thin borders, one accent, plain language.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-medium text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ---------- Card / section ---------- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface", padded && "p-5", className)}>{children}</div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  fill = false,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Stretch the body to the full height of the grid cell, so paired sections line up. */
  fill?: boolean;
}) {
  return (
    <section className={cx("space-y-3", fill && "flex h-full flex-col [&>*:last-child]:flex-1", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-ink">{title}</h2>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0 text-sm">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/* ---------- Stat ---------- */

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-faint" />}
      </div>
      <div className="figure mt-2 text-[28px] leading-none font-medium text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface text-center",
        compact ? "px-5 py-6" : "px-6 py-12",
        className
      )}
    >
      {Icon && (
        <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-subtle flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted" />
        </div>
      )}
      <p className="font-serif text-lg font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover px-3.5 py-2",
  secondary: "bg-surface text-ink-2 border border-line hover:bg-subtle px-3.5 py-2",
  ghost: "text-muted hover:text-ink hover:bg-subtle px-2.5 py-1.5",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft px-3.5 py-2",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cx(buttonBase, buttonVariants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

/* ---------- Status label ---------- */

export type Tone = "neutral" | "accent" | "positive" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Form fields ---------- */

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------- Score ---------- */

/** Readiness / match score as a number with a slim bar. */
export function ScoreBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 75 ? "bg-positive" : clamped >= 50 ? "bg-accent" : "bg-warning";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        {label && <span className="text-muted">{label}</span>}
        <span className="font-semibold text-ink tabular-nums">{Math.round(clamped)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-subtle overflow-hidden">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/* ---------- Shared workspace pieces ---------- */

export function Avatar({ name }: { name?: string }) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">
      {initials}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-subtle p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm",
            value === o.value ? "bg-surface font-medium text-ink shadow-subtle" : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-start justify-between gap-6 py-4 first:pt-0", disabled ? "cursor-default" : "cursor-pointer")}>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-sm text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          checked ? "bg-accent" : "bg-line-strong",
          disabled && "opacity-60"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </span>
    </label>
  );
}

export function FormFooter({ saved, label }: { saved: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-positive">
          <CheckCircle2 className="w-4 h-4" />
          Saved
        </span>
      )}
      <button type="submit" className={buttonClass("primary")}>
        {label}
      </button>
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
      ))}
    </div>
  );
}
