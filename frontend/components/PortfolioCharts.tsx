"use client";

import React, { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { formatAxis, formatCompact, formatCurrency, formatDate, formatSigned, toNumber } from "@/lib/money";
import type { Holding, SeriesPoint } from "@/types";

/*
 * Hand-built SVG charts for Portfolio & Finances. One axis per chart, thin marks,
 * recessive grid, legend + direct labels, hover tooltips, and a table view.
 * Series colors (validated for contrast and colour-blind separation on white):
 *   value   #2a5ea8 (brand blue family)
 *   cost    #eb6834
 */
export const SERIES = { value: "#2a5ea8", cost: "#eb6834" };

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Round axis maximum and ~4 ticks. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="14" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="14" y2="4" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "3 2" : undefined} />
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ value over time */

export function ValueOverTimeChart({ points }: { points: SeriesPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const pad = { top: 12, right: 92, bottom: 26, left: 56 };

  const rows = points.map((p) => ({
    date: p.date,
    invested: toNumber(p.invested),
    worth: toNumber(p.value) + toNumber(p.returned),
    value: toNumber(p.value),
    returned: toNumber(p.returned),
  }));

  if (rows.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">The chart fills in once your records span more than one month.</p>;
  }

  const ticks = niceTicks(Math.max(...rows.map((r) => Math.max(r.invested, r.worth))));
  const yMax = ticks[ticks.length - 1] || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (i / (rows.length - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const path = (key: "invested" | "worth") => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join("");

  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(innerW / 80))));
  const last = rows[rows.length - 1];
  // Keep the two end labels from colliding.
  let worthY = y(last.worth);
  let investedY = y(last.invested);
  if (Math.abs(worthY - investedY) < 14) {
    if (worthY <= investedY) worthY = investedY - 14;
    else investedY = worthY - 14;
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * innerW;
    setHover(Math.max(0, Math.min(rows.length - 1, Math.round((rel / innerW) * (rows.length - 1)))));
  };
  const h = hover != null ? rows[hover] : null;

  return (
    <div className="space-y-3">
      <Legend
        items={[
          { label: "Value (holdings + cash returned)", color: SERIES.value },
          { label: "Invested", color: SERIES.cost },
        ]}
      />
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label="Portfolio value compared with capital invested, by month">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[11px] tabular-nums">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) =>
            i % labelEvery === 0 || i === rows.length - 1 ? (
              <text key={r.date} x={x(i)} y={height - 6} textAnchor="middle" className="fill-[var(--color-muted)] text-[11px]">
                {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              </text>
            ) : null
          )}
          <path d={path("invested")} fill="none" stroke={SERIES.cost} strokeWidth="2" strokeLinejoin="round" />
          <path d={path("worth")} fill="none" stroke={SERIES.value} strokeWidth="2" strokeLinejoin="round" />
          <text x={x(rows.length - 1) + 8} y={worthY} dy="0.32em" className="fill-[var(--color-ink-2)] text-[11px] font-medium">
            Value
          </text>
          <text x={x(rows.length - 1) + 8} y={investedY} dy="0.32em" className="fill-[var(--color-ink-2)] text-[11px] font-medium">
            Invested
          </text>
          {h && hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--color-line-strong)" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h.worth)} r="4" fill={SERIES.value} stroke="white" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(h.invested)} r="4" fill={SERIES.cost} stroke="white" strokeWidth="2" />
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-56 rounded-lg border border-line bg-surface p-3 text-xs shadow-card"
            style={{ left: Math.min(Math.max(0, x(hover) + 12), width - 232) }}
          >
            <div className="mb-1.5 font-medium text-ink">{formatDate(h.date)}</div>
            <TipRow color={SERIES.value} label="Value" value={formatCurrency(h.worth)} />
            <div className="pl-4 text-muted">
              holdings {formatCompact(h.value)} · returned {formatCompact(h.returned)}
            </div>
            <TipRow color={SERIES.cost} label="Invested" value={formatCurrency(h.invested)} />
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 font-medium">Month end</th>
                <th className="py-1.5 text-right font-medium">Invested</th>
                <th className="py-1.5 text-right font-medium">Holdings</th>
                <th className="py-1.5 text-right font-medium">Cash returned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="py-1.5">{formatDate(r.date)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(r.invested)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(r.value)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(r.returned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ invested vs value, per company */

export function CompanyComparison({ holdings, limit = 8 }: { holdings: Holding[]; limit?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = [...holdings]
    .map((h) => ({
      id: h.id,
      name: h.company_name,
      cost: toNumber(h.cost_basis),
      worth: toNumber(h.current_value) + toNumber(h.cash_returned),
      basis: h.valuation_basis,
      net: h.net_gain,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cost, r.worth)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <Swatch color={SERIES.cost} label="Invested" />
          <Swatch color={SERIES.value} label="Value (holding + cash returned)" />
        </div>
        {holdings.length > limit && <span className="text-xs text-muted">Largest {limit} of {holdings.length}</span>}
      </div>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className="relative"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink-2">{r.name}</span>
              <span className={cx("shrink-0 text-xs tabular-nums", toNumber(r.net) < 0 ? "text-danger" : "text-muted")}>
                {formatSigned(r.net)}
                {r.basis === "cost" && " · at cost"}
              </span>
            </div>
            <Bar value={r.cost} max={max} color={SERIES.cost} />
            <div className="h-0.5" />
            <Bar value={r.worth} max={max} color={SERIES.value} />
            {hover === i && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-line bg-surface p-3 text-xs shadow-card">
                <TipRow color={SERIES.cost} label="Invested" value={formatCurrency(r.cost)} />
                <TipRow color={SERIES.value} label="Value" value={formatCurrency(r.worth)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, (value / max) * 100);
  return (
    <div className="h-2 w-full rounded-r bg-subtle">
      <div className="h-2 rounded-r" style={{ width: `${pct}%`, minWidth: value > 0 ? 2 : 0, background: color }} />
    </div>
  );
}

/* ------------------------------------------------------------------ simple labelled bars */

/** Horizontal bars for one measure (allocation share, realized vs unrealized). Handles negatives. */
export function LabelledBars({
  rows,
  color = SERIES.value,
}: {
  rows: { label: string; value: number; display: string; note?: string }[];
  color?: string;
}) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const hasNegative = rows.some((r) => r.value < 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = (Math.abs(r.value) / maxAbs) * (hasNegative ? 50 : 100);
        return (
          <li key={r.label} title={`${r.label}: ${r.display}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink-2">{r.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{r.display}</span>
            </div>
            <div className="relative h-2 w-full rounded bg-subtle">
              {hasNegative && <div className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-line-strong" />}
              <div
                className={cx("absolute top-0 h-2", r.value < 0 ? "rounded-l" : "rounded-r")}
                style={{
                  width: `${pct}%`,
                  minWidth: r.value !== 0 ? 2 : 0,
                  background: color,
                  left: hasNegative ? (r.value < 0 ? `${50 - pct}%` : "50%") : 0,
                }}
              />
            </div>
            {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
