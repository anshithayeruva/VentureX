"use client";

import React, { useId, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, MinusCircle, X } from "lucide-react";
import { Button, Card, cx, inputClass } from "@/components/ui";

/* Form pieces shared by the investor criteria, discovery and portfolio screens. */

/** Toggleable chips for picking several values from a fixed list. */
export function ChipGroup({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {all.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((v) => v !== option) : [...selected, option])}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-ink-2 hover:bg-canvas"
            )}
          >
            {on && <Check className="h-3.5 w-3.5" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text list: type a value and press Enter (or pick a suggestion). */
export function TagInput({
  values,
  onChange,
  placeholder,
  suggestions = [],
  id,
  max = 40,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  id?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const v = raw.trim().slice(0, 80);
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase()) || values.length >= max) return setDraft("");
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-1 text-sm text-ink-2">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        className={inputClass}
        value={draft}
        placeholder={placeholder}
        list={suggestions.length ? listId : undefined}
        onChange={(e) => {
          const v = e.target.value;
          // Picking from the datalist fills the whole value at once: add it straight away.
          if (suggestions.includes(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !values.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** A small segmented control for compact rows (requirement levels, priorities). */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-subtle p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-2.5 py-1 text-xs sm:text-sm",
            value === o.value ? "bg-surface font-medium text-ink shadow-subtle" : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A rupee amount kept as a string, so what you type is exactly what is sent. */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-2 text-sm text-faint">₹</span>
      <input
        id={id}
        inputMode="decimal"
        required={required}
        placeholder={placeholder}
        className={cx(inputClass, "pl-7 tabular-nums")}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,]/g, "");
          onChange(v === "" ? null : v);
        }}
      />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <div className="text-sm font-medium text-ink">Something went wrong</div>
          <p className="text-sm text-muted">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span className="text-muted tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-muted tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

/** Inline confirmation / error banner. */
export function Notice({ text, ok }: { text: string; ok: boolean }) {
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cx("flex items-center gap-2 rounded-lg px-4 py-3 text-sm", ok ? "bg-positive-soft text-positive" : "bg-danger-soft text-danger")}
    >
      {ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      {text}
    </div>
  );
}

/** One match reason, marked as met (check) or not met (dash) so a mismatch never looks like a fit. */
export function ReasonLine({ reason }: { reason: { category: string; explanation: string; score?: number } }) {
  const met = reason.score == null || reason.score >= 75;
  return (
    <li className="flex gap-2 text-sm text-muted">
      {met ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-label="Met" />
      ) : (
        <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-label="Not met" />
      )}
      <span>{reason.explanation}</span>
    </li>
  );
}
