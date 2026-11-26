"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cx } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { UpdateMetrics } from "@/types";

/* Shared pieces for founder updates to investors. */

type MetricKey = "monthly_revenue" | "customers" | "cash_in_bank" | "monthly_burn" | "runway_months" | "headcount" | "post_money_valuation";

export const METRIC_FIELDS: { key: Exclude<MetricKey, "runway_months">; label: string; money: boolean; hint?: string }[] = [
  { key: "monthly_revenue", label: "Monthly revenue", money: true },
  { key: "customers", label: "Customers", money: false },
  { key: "cash_in_bank", label: "Cash in bank", money: true },
  { key: "monthly_burn", label: "Monthly burn", money: true },
  { key: "headcount", label: "Headcount", money: false },
  { key: "post_money_valuation", label: "Post-money valuation", money: true, hint: "Only after a priced round" },
];

const TILE_ORDER: { key: MetricKey; label: string; kind: "money" | "count" | "months"; upIsGood: boolean }[] = [
  { key: "monthly_revenue", label: "Monthly revenue", kind: "money", upIsGood: true },
  { key: "customers", label: "Customers", kind: "count", upIsGood: true },
  { key: "cash_in_bank", label: "Cash in bank", kind: "money", upIsGood: true },
  { key: "monthly_burn", label: "Monthly burn", kind: "money", upIsGood: false },
  { key: "runway_months", label: "Runway", kind: "months", upIsGood: true },
  { key: "headcount", label: "Headcount", kind: "count", upIsGood: true },
  { key: "post_money_valuation", label: "Post-money valuation", kind: "money", upIsGood: true },
];

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function show(kind: "money" | "count" | "months", v: number): string {
  if (kind === "money") return formatMoney(v);
  if (kind === "months") return `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} months`;
  return v.toLocaleString("en-IN");
}

/** Metric tiles; with `previous`, each shows the change since the last update. */
export function MetricsGrid({ metrics, previous, previousLabel }: { metrics: UpdateMetrics; previous?: UpdateMetrics | null; previousLabel?: string }) {
  const tiles = TILE_ORDER.filter((t) => num(metrics[t.key]) !== null);
  const custom = metrics.custom ?? [];
  if (!tiles.length && !custom.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const v = num(metrics[t.key]) as number;
        const before = previous ? num(previous[t.key]) : null;
        const change = before !== null && before !== 0 ? ((v - before) / Math.abs(before)) * 100 : null;
        const good = change !== null && (change >= 0) === t.upIsGood;
        return (
          <div key={t.key} className="min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="figure mt-0.5 truncate text-lg text-ink">{show(t.kind, v)}</div>
            {change !== null && Math.abs(change) >= 0.5 && (
              <div
                className={cx("mt-0.5 inline-flex items-center gap-0.5 text-xs", good ? "text-positive" : "text-danger")}
                title={previousLabel ? `vs ${previousLabel}` : undefined}
              >
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change).toFixed(0)}%{previousLabel ? <span className="text-faint"> vs {previousLabel}</span> : null}
              </div>
            )}
          </div>
        );
      })}
      {custom.map((c) => (
        <div key={c.label} className="min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
          <div className="truncate text-xs text-muted">{c.label}</div>
          <div className="figure mt-0.5 truncate text-lg text-ink">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export function TextSection({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <h3 className="font-sans text-sm font-medium text-muted">{title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

