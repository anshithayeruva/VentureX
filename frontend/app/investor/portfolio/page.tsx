"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Plus, Wallet, X } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { CompanyComparison, LabelledBars, SERIES, ValueOverTimeChart } from "@/components/PortfolioCharts";
import { ErrorState, MoneyInput, Pagination } from "@/components/forms";
import { Button, Card, EmptyState, Field, LoadingRows, PageHeader, Segmented, Tag, cx, inputClass } from "@/components/ui";
import { INDUSTRIES } from "@/components/ProjectForm";
import { api } from "@/lib/api";
import { cleanMoneyInput, formatCompact, formatCurrency, formatDate, formatSigned, gainTone, toNumber, todayISO } from "@/lib/money";
import { INSTRUMENT_LABEL } from "@/lib/thesis";
import { STATUS_TAG, TXN_LABEL } from "@/lib/portfolio";
import type { Holding, Instrument, PortfolioSummary, TransactionPage, TransactionType } from "@/types";

type View = "overview" | "investments" | "transactions";


function PortfolioContent() {
  const router = useRouter();
  const params = useSearchParams();
  const recordParam = params.get("record");

  const [view, setView] = useState<View>("overview");
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(Boolean(recordParam));

  const load = useCallback(() => {
    api
      .getPortfolioSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your portfolio."));
  }, []);
  useEffect(load, [load]);

  const t = summary?.totals;
  const empty = summary != null && summary.holdings.length === 0;

  return (
    <PortalLayout role="INVESTOR" activeItem="portfolio" title="Portfolio & Finances">
      <PageHeader
        title="Portfolio & Finances"
        description="The investments you've made, what they're worth and what they've returned, from the records you keep here."
        actions={
          !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Record investment
            </Button>
          )
        }
      />

      <p className="mb-6 flex items-start gap-2 rounded-lg bg-subtle px-4 py-3 text-sm text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <span>
          Every figure comes from investments, transactions and valuations you record. VentureX doesn&apos;t verify them, and an intro request or deal
          room is never counted as an investment.
        </span>
      </p>

      {showForm && (
        <RecordInvestmentForm
          projectId={recordParam && recordParam !== "new" ? Number(recordParam) : null}
          company={params.get("company") ?? ""}
          onCancel={() => {
            setShowForm(false);
            if (recordParam) router.replace("/investor/portfolio");
          }}
          onCreated={(id) => router.push(`/investor/portfolio/${id}`)}
        />
      )}

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !summary || !t ? (
        <LoadingRows />
      ) : empty ? (
        !showForm && (
          <EmptyState
            icon={Wallet}
            title="No investments recorded yet"
            description="Record an investment you've made to track its value, cash returned and overall return. Nothing is filled in for you."
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Record investment
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-6">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "overview", label: "Overview" },
              { value: "investments", label: `Investments ${summary.holdings.length}` },
              { value: "transactions", label: "Transactions" },
            ]}
          />

          {view === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Metric label="Total invested" value={formatCompact(t.total_invested)} hint="Investments, follow-ons and fees" />
                <Metric
                  label="Current value"
                  value={formatCompact(t.current_value)}
                  hint={t.held_at_cost_count ? `${t.held_at_cost_count} held at cost (no valuation)` : "From your latest valuations"}
                />
                <Metric label="Cash returned" value={formatCompact(t.cash_returned)} hint={`${formatCompact(t.income)} dividends & interest`} />
                <Metric
                  label="Net gain"
                  value={formatSigned(t.net_gain)}
                  tone={gainTone(t.net_gain)}
                  hint={t.roi_pct != null ? `${toNumber(t.roi_pct) > 0 ? "+" : ""}${t.roi_pct}% ROI · ${t.multiple}× multiple` : undefined}
                />
                <Metric label="Realized gain" value={formatSigned(t.realized_gain)} tone={gainTone(t.realized_gain)} hint="Settled in cash" />
                <Metric label="Unrealized gain" value={formatSigned(t.unrealized_gain)} tone={gainTone(t.unrealized_gain)} hint="Estimated, from valuations" />
                <Metric label="Active" value={t.active_count} hint="Holdings still open" />
                <Metric
                  label="Exited"
                  value={t.exited_count}
                  hint={t.written_off_count ? `${t.written_off_count} written off` : t.pending_transactions ? `${t.pending_transactions} pending transactions` : "Fully realized"}
                />
              </div>
              <p className="text-xs text-muted">
                ROI and multiple include unrealized value, which is an estimate based on the valuations you record. Pending transactions aren&apos;t counted.
              </p>

              <Card className="space-y-4">
                <h2 className="text-lg font-medium text-ink">Value over time</h2>
                <ValueOverTimeChart points={summary.value_over_time} />
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="space-y-4">
                  <h2 className="text-lg font-medium text-ink">Invested vs value, by company</h2>
                  <CompanyComparison holdings={summary.holdings} />
                </Card>
                <div className="space-y-6">
                  <Card className="space-y-4">
                    <h2 className="text-lg font-medium text-ink">Realized vs unrealized</h2>
                    <LabelledBars
                      rows={[
                        { label: "Realized gain", value: toNumber(t.realized_gain), display: formatSigned(t.realized_gain, true), note: "Cash returned minus the cost of what it came from." },
                        { label: "Unrealized gain", value: toNumber(t.unrealized_gain), display: formatSigned(t.unrealized_gain, true), note: "Current value of open holdings minus their cost." },
                      ]}
                    />
                  </Card>
                  <Card className="space-y-4">
                    <h2 className="text-lg font-medium text-ink">Allocation by industry</h2>
                    {summary.allocation_by_industry.length ? (
                      <LabelledBars
                        color={SERIES.value}
                        rows={summary.allocation_by_industry.map((a) => ({
                          label: a.label,
                          value: toNumber(a.share_pct),
                          display: `${a.share_pct}% · ${formatCompact(a.cost_basis)}`,
                        }))}
                      />
                    ) : (
                      <p className="text-sm text-muted">No invested capital yet.</p>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}

          {view === "investments" && <HoldingsTable holdings={summary.holdings} />}
          {view === "transactions" && <TransactionsView />}
        </div>
      )}
    </PortalLayout>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "positive" | "danger" | "neutral";
}) {
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className={cx("figure mt-2 text-[28px] leading-none font-medium", tone === "positive" ? "text-positive" : tone === "danger" ? "text-danger" : "text-ink")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  return (
    <Card padded={false} className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Company</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 text-right font-medium">Invested</th>
            <th className="px-3 py-3 text-right font-medium">Current value</th>
            <th className="px-3 py-3 text-right font-medium">Cash returned</th>
            <th className="px-3 py-3 text-right font-medium">Net gain</th>
            <th className="px-5 py-3 text-right font-medium">Multiple</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {holdings.map((h) => (
            <tr key={h.id} className="hover:bg-canvas">
              <td className="px-5 py-3">
                <Link href={`/investor/portfolio/${h.id}`} className="font-medium text-ink hover:underline">
                  {h.company_name}
                </Link>
                <div className="text-xs text-muted">
                  {[INSTRUMENT_LABEL[h.instrument], h.industry, formatDate(h.investment_date)].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td className="px-3 py-3">
                <Tag tone={STATUS_TAG[h.status].tone}>{STATUS_TAG[h.status].label}</Tag>
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(h.cost_basis)}</td>
              <td className="px-3 py-3 text-right">
                {formatCurrency(h.current_value)}
                <div className="text-xs text-muted">
                  {h.valuation_basis === "cost" ? "at cost" : h.valuation_basis === "valuation" ? `as of ${formatDate(h.valuation_date)}` : ""}
                </div>
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(h.cash_returned)}</td>
              <td className={cx("px-3 py-3 text-right", gainTone(h.net_gain) === "positive" ? "text-positive" : gainTone(h.net_gain) === "danger" ? "text-danger" : "")}>
                {formatSigned(h.net_gain, true)}
              </td>
              <td className="px-5 py-3 text-right">{h.multiple ? `${h.multiple}×` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TransactionsView() {
  const [type, setType] = useState<TransactionType | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ key: string; page: TransactionPage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${type}:${page}`;

  useEffect(() => {
    let current = true;
    api
      .getTransactions({ type: type || undefined, page, page_size: 20 })
      .then((res) => current && setData({ key, page: res }))
      .catch((err) => current && setError(err instanceof Error ? err.message : "Couldn't load transactions."));
    return () => {
      current = false;
    };
  }, [type, page, key]);

  return (
    <div className="space-y-4">
      <select
        aria-label="Transaction type"
        className={cx(inputClass, "sm:w-56")}
        value={type}
        onChange={(e) => {
          setType(e.target.value as TransactionType | "");
          setPage(1);
        }}
      >
        <option value="">All transaction types</option>
        {Object.entries(TXN_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingRows />
      ) : data.page.items.length === 0 ? (
        <EmptyState compact title="No transactions of this type" />
      ) : (
        <>
          <Card padded={false} className={cx("overflow-x-auto", data.key !== key && "opacity-60")}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {data.page.items.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-5 py-3 whitespace-nowrap">{formatDate(tx.txn_date)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/investor/portfolio/${tx.investment_id}`} className="text-ink hover:underline">
                        {tx.company_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {TXN_LABEL[tx.type]}
                      {tx.status === "pending" && (
                        <Tag tone="warning" className="ml-2">
                          Pending
                        </Tag>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted">{tx.description || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {["investment", "follow_on", "fee"].includes(tx.type) ? "−" : "+"}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={data.page.page} pageSize={data.page.page_size} total={data.page.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function RecordInvestmentForm({
  projectId,
  company,
  onCancel,
  onCreated,
}: {
  projectId: number | null;
  company: string;
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({
    company_name: company,
    industry: "",
    stage: "",
    instrument: "equity" as Instrument,
    investment_date: todayISO(),
    amount: null as string | null,
    ownership_pct: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = form.amount ? cleanMoneyInput(form.amount) : null;
    if (!amount || toNumber(amount) <= 0) return setError("Enter the amount you invested, like 50000 or 50000.00.");
    if (!projectId && !form.company_name.trim()) return setError("Add the company name.");
    const pct = form.ownership_pct.trim();
    if (pct && !/^\d{1,3}(\.\d{1,4})?$/.test(pct)) return setError("Ownership should be a percentage like 2.5.");
    setSaving(true);
    try {
      const created = await api.createInvestment({
        company_name: form.company_name.trim() || undefined,
        project_id: projectId,
        industry: form.industry,
        stage: form.stage,
        instrument: form.instrument,
        investment_date: form.investment_date,
        amount,
        ownership_pct: pct || null,
        notes: form.notes.trim(),
      });
      onCreated(created.holding.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record the investment.");
      setSaving(false);
    }
  };

  return (
    <Card className="mb-8">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-ink">Record an investment</h2>
            <p className="text-sm text-muted">The amount becomes the first transaction. Add follow-ons, returns and valuations on the next screen.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Company" htmlFor="ri-company" hint={projectId ? "Linked to the startup from your deal flow." : undefined}>
            <input id="ri-company" className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required={!projectId} maxLength={160} />
          </Field>
          <Field label="Amount invested" htmlFor="ri-amount">
            <MoneyInput id="ri-amount" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          </Field>
          <Field label="Date" htmlFor="ri-date">
            <input id="ri-date" type="date" max={todayISO()} required className={inputClass} value={form.investment_date} onChange={(e) => setForm({ ...form, investment_date: e.target.value })} />
          </Field>
          <Field label="Instrument" htmlFor="ri-instrument">
            <select id="ri-instrument" className={inputClass} value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value as Instrument })}>
              {Object.entries(INSTRUMENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Industry" htmlFor="ri-industry" hint={projectId ? "Leave blank to use the startup's." : undefined}>
            <input id="ri-industry" list="ri-industries" className={inputClass} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} maxLength={100} />
            <datalist id="ri-industries">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </Field>
          <Field label="Ownership %" htmlFor="ri-own" hint="Optional.">
            <input id="ri-own" inputMode="decimal" className={inputClass} value={form.ownership_pct} onChange={(e) => setForm({ ...form, ownership_pct: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="ri-notes" hint="Optional. Round details, co-investors, terms.">
          <textarea id="ri-notes" rows={2} maxLength={2000} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60">
            {saving ? "Saving…" : "Record investment"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <PortfolioContent />
    </Suspense>
  );
}
