"use client";

import React from "react";
import { Tag, cx } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { formatCompact, toNumber } from "@/lib/money";
import type { Allocation, AllocationStatus, FundingInstrument, FundingRound, Ownership, RoundStatus, RoundSummary } from "@/types";

/* Shared funding pieces. All amounts and percentages come from the API (server-side Decimal maths);
   the browser only formats them and sizes the progress bar. */

export const INSTRUMENT_NAME: Record<FundingInstrument, string> = {
  equity: "Priced equity",
  safe: "SAFE",
  convertible_note: "Convertible note",
  other: "Other",
};

export const ROUND_TYPE_NAME: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  bridge: "Bridge",
  other: "Other",
};

const ALLOC: Record<AllocationStatus, { label: string; tone: Tone; hint: string }> = {
  proposed: { label: "Under review", tone: "warning", hint: "The investor proposed this amount; not committed." },
  accepted: { label: "Terms agreed", tone: "accent", hint: "The founders accepted; waiting for the investor to confirm." },
  committed: { label: "Committed", tone: "positive", hint: "Confirmed by both sides; no capital received yet." },
  partially_funded: { label: "Partly received", tone: "positive", hint: "Some of the committed capital has been received." },
  funded: { label: "Fully received", tone: "positive", hint: "All committed capital has been received." },
  rejected: { label: "Declined", tone: "neutral", hint: "The founders declined this proposal." },
  cancelled: { label: "Cancelled", tone: "neutral", hint: "Withdrawn or cancelled; doesn't count." },
};

const ROUND: Record<RoundStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "positive" },
  closed: { label: "Closed", tone: "accent" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function AllocationStatusTag({ status }: { status: AllocationStatus }) {
  const s = ALLOC[status];
  return <span title={s.hint}><Tag tone={s.tone}>{s.label}</Tag></span>;
}

export function RoundStatusTag({ status }: { status: RoundStatus }) {
  const s = ROUND[status];
  return <Tag tone={s.tone}>{s.label}</Tag>;
}

/** Target bar: received (solid), committed but not yet received (lighter), remaining (empty). */
export function FundingBar({ summary }: { summary: RoundSummary }) {
  const target = toNumber(summary.target);
  const committed = Math.min(toNumber(summary.committed), target);
  const received = Math.min(toNumber(summary.received), committed);
  if (!target) return null;
  const w = (n: number) => `${Math.max(0, Math.min(100, (n / target) * 100))}%`;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-subtle" role="img"
        aria-label={`${summary.committed_pct ?? 0}% of the target committed, ${summary.received_pct ?? 0}% received`}>
        <div className="h-full bg-positive" style={{ width: w(received) }} />
        <div className="h-full bg-positive/35" style={{ width: w(committed - received) }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" />Received</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive/35" />Committed, not yet received</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-subtle ring-1 ring-line" />Remaining</span>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "positive" }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("figure mt-0.5 truncate text-lg", tone === "positive" ? "text-positive" : "text-ink")}>{value}</div>
      {sub && <div className="truncate text-xs text-faint">{sub}</div>}
    </div>
  );
}

/** Round-level figures. Hidden fields (when founders keep progress private) simply aren't shown. */
export function FundingOverview({ summary }: { summary: RoundSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Funding target" value={formatCompact(summary.target)} />
        {summary.committed !== undefined && (
          <>
            <Metric label="Committed" value={formatCompact(summary.committed)} sub={summary.committed_pct ? `${summary.committed_pct}% of target` : undefined} tone="positive" />
            <Metric label="Received" value={formatCompact(summary.received)} sub={summary.received_pct ? `${summary.received_pct}% of target` : undefined} />
            <Metric label="Remaining to raise" value={formatCompact(summary.remaining)} sub={summary.oversubscribed_by ? `Oversubscribed by ${formatCompact(summary.oversubscribed_by)}` : undefined} />
            <Metric label="Committed, not received" value={formatCompact(summary.unreceived_committed)} />
            <Metric label="Investors" value={String(summary.investor_count ?? 0)} sub={summary.in_negotiation_count ? `${summary.in_negotiation_count} in negotiation` : undefined} />
          </>
        )}
      </div>
      {summary.committed !== undefined && <FundingBar summary={summary} />}
    </div>
  );
}

/** Agreed equity, or an indicative figure clearly labelled as such, or nothing for SAFEs and notes. */
export function OwnershipCell({ ownership }: { ownership: Ownership }) {
  if (ownership.agreed_equity_pct) {
    return <span title={ownership.basis ?? undefined}>{Number(ownership.agreed_equity_pct)}% <span className="text-xs text-muted">agreed</span></span>;
  }
  if (ownership.indicative_equity_pct) {
    return <span title={ownership.basis ?? undefined}>~{Number(ownership.indicative_equity_pct).toFixed(2)}% <span className="text-xs text-warning">indicative</span></span>;
  }
  return <span className="text-xs text-muted" title={ownership.basis ?? undefined}>{ownership.instrument === "safe" || ownership.instrument === "convertible_note" ? "Converts later" : "—"}</span>;
}

/** The round's terms in one line. */
export function roundTerms(r: Pick<FundingRound, "instrument" | "round_type" | "min_ticket" | "max_ticket" | "pre_money_valuation" | "post_money_valuation" | "valuation_cap" | "discount_pct" | "closes_on">): string {
  const parts = [ROUND_TYPE_NAME[r.round_type] ?? r.round_type, INSTRUMENT_NAME[r.instrument]];
  if (r.min_ticket || r.max_ticket) parts.push(`tickets ${r.min_ticket ? formatCompact(r.min_ticket) : "any"}–${r.max_ticket ? formatCompact(r.max_ticket) : "any"}`);
  if (r.pre_money_valuation) parts.push(`pre-money ${formatCompact(r.pre_money_valuation)}`);
  if (r.post_money_valuation) parts.push(`post-money ${formatCompact(r.post_money_valuation)}`);
  if (r.valuation_cap) parts.push(`cap ${formatCompact(r.valuation_cap)}`);
  if (r.discount_pct) parts.push(`${Number(r.discount_pct)}% discount`);
  return parts.join(" · ");
}

export function allocationAmount(a: Pick<Allocation, "status" | "committed_amount" | "proposed_amount">): string | null {
  return a.status === "proposed" ? a.proposed_amount : a.committed_amount ?? a.proposed_amount;
}
