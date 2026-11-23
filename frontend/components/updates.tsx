"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/format";
import type { InvestorUpdateItem, UpdateMetrics } from "@/types";

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

/** The latest updates from one portfolio company (on the investor's holding page). */
export function CompanyUpdatesPanel({ projectId }: { projectId: number }) {
  const [items, setItems] = useState<InvestorUpdateItem[] | null>(null);
  useEffect(() => {
    let active = true;
    api
      .getInvestorUpdates({ project_id: projectId })
      .then((d) => active && setItems(d.items.slice(0, 3)))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [projectId]);
  if (items === null) return null;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-ink">Company updates</h2>
        {items.length > 0 && (
          <Link href={`/investor/updates?project=${projectId}`} className="text-sm text-accent hover:underline">See all</Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Inbox className="h-4 w-4" />
          No updates from this company yet. They arrive here when the founder sends one.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((u) => (
            <li key={u.id} className="py-2.5">
              <Link href={`/investor/updates?project=${projectId}&update=${u.id}`} className="flex items-start justify-between gap-3 hover:underline">
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink">{u.period_label}</span>
                  {!u.read_at && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                  <span className="line-clamp-1 text-sm text-muted">{u.highlights || u.challenges}</span>
                </span>
                <span className="shrink-0 text-xs text-faint">{u.sent_at ? timeAgo(u.sent_at) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
