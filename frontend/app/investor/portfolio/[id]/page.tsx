"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileQuestion, Trash2 } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, MoneyInput, Notice } from "@/components/forms";
import { Button, ButtonLink, Card, EmptyState, Field, LoadingRows, Tag, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cleanMoneyInput, formatCurrency, formatDate, formatSigned, gainTone, toNumber, todayISO } from "@/lib/money";
import { COST_TYPES, SOURCE_LABEL, STATUS_TAG, TXN_LABEL } from "@/lib/portfolio";
import { INSTRUMENT_LABEL } from "@/lib/thesis";
import type { InvestmentDetail, InvestmentStatus, TransactionType, ValuationSource } from "@/types";

export default function InvestmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const investmentId = Number(id);
  const router = useRouter();

  const [detail, setDetail] = useState<InvestmentDetail | null>(null);
  const [missing, setMissing] = useState(!Number.isInteger(investmentId) || investmentId <= 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    if (!Number.isInteger(investmentId) || investmentId <= 0) return;
    api
      .getInvestment(investmentId)
      .then((d) => (d ? setDetail(d) : setMissing(true)))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this investment."));
  }, [investmentId]);
  useEffect(load, [load]);

  const flash = (text: string, ok = true) => {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), ok ? 4000 : 8000);
  };

  /** Run a change, then show the server's recomputed figures. */
  const mutate = async (action: () => Promise<InvestmentDetail | void>, done: string) => {
    try {
      const next = await action();
      if (next) setDetail(next);
      else load();
      flash(done);
      return true;
    } catch (err) {
      flash(err instanceof Error ? err.message : "That didn't work.", false);
      return false;
    }
  };

  if (missing) {
    return (
      <PortalLayout role="INVESTOR" activeItem="portfolio" title="Investment">
        <EmptyState
          icon={FileQuestion}
          title="Investment not found"
          description="It may have been deleted."
          action={<ButtonLink href="/investor/portfolio">Back to portfolio</ButtonLink>}
        />
      </PortalLayout>
    );
  }

  if (error || !detail) {
    return (
      <PortalLayout role="INVESTOR" activeItem="portfolio" title="Investment">
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              load();
            }}
          />
        ) : (
          <LoadingRows />
        )}
      </PortalLayout>
    );
  }

  const h = detail.holding;
  const status = STATUS_TAG[h.status];

  return (
    <PortalLayout role="INVESTOR" activeItem="portfolio" title={h.company_name}>
      <div className="space-y-8">
        <div>
          <Link href="/investor/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Portfolio
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] leading-tight font-medium text-ink">{h.company_name}</h1>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
              <p className="mt-1 text-sm text-muted">
                {[INSTRUMENT_LABEL[h.instrument], h.industry, h.stage, `invested ${formatDate(h.investment_date)}`, h.ownership_pct ? `${Number(h.ownership_pct)}% ownership` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {h.project_id && (
                <Link href={`/investor/projects/${h.project_id}`} className="mt-1 inline-block text-sm text-accent hover:underline">
                  View startup on VentureX
                </Link>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                aria-label="Holding status"
                className={cx(inputClass, "w-40")}
                value={h.status}
                onChange={(e) =>
                  mutate(() => api.updateInvestment(h.id, { status: e.target.value as InvestmentStatus }), "Status updated.")
                }
              >
                <option value="active">Active</option>
                <option value="exited">Exited</option>
                <option value="written_off">Written off</option>
              </select>
              <Button
                variant="danger"
                aria-label="Delete investment"
                onClick={async () => {
                  if (!window.confirm(`Delete ${h.company_name} and all its transactions and valuations? This can't be undone.`)) return;
                  try {
                    await api.deleteInvestment(h.id);
                    router.push("/investor/portfolio");
                  } catch (err) {
                    flash(err instanceof Error ? err.message : "Couldn't delete the investment.", false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {notice && <Notice {...notice} />}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Figure label="Invested" value={formatCurrency(h.cost_basis)} hint="Including follow-ons and fees" />
          <Figure
            label="Current value"
            value={formatCurrency(h.current_value)}
            hint={
              h.valuation_basis === "valuation"
                ? `${SOURCE_LABEL[h.valuation_source ?? "self_reported"]}, ${formatDate(h.valuation_date)}`
                : h.valuation_basis === "cost"
                  ? "Held at cost: no valuation recorded"
                  : h.valuation_basis === "exited"
                    ? "Exited"
                    : "Written off"
            }
          />
          <Figure label="Cash returned" value={formatCurrency(h.cash_returned)} hint="Distributions, dividends, exit, interest" />
          <Figure
            label="Net gain"
            value={formatSigned(h.net_gain, true)}
            tone={gainTone(h.net_gain)}
            hint={h.multiple ? `${h.multiple}× multiple · includes estimated value` : undefined}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-medium text-ink">Transactions</h2>
            <TransactionForm
              onAdd={(data) => mutate(() => api.addTransaction(h.id, data), `${TXN_LABEL[data.type]} added.`)}
              minDate={h.investment_date}
            />
            <ul className="divide-y divide-line">
              {detail.transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-ink">
                      {TXN_LABEL[tx.type]}
                      {tx.status === "pending" && (
                        <Tag tone="warning" className="ml-2">
                          Pending
                        </Tag>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {formatDate(tx.txn_date)}
                      {tx.description && ` · ${tx.description}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-ink">
                      {COST_TYPES.includes(tx.type) ? "−" : "+"}
                      {formatCurrency(tx.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${TXN_LABEL[tx.type]} of ${formatCurrency(tx.amount)}`}
                      className="rounded-md p-1 text-faint hover:bg-subtle hover:text-danger"
                      onClick={() => {
                        if (window.confirm("Delete this transaction?")) mutate(() => api.deleteTransaction(tx.id), "Transaction deleted.");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>


          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-medium text-ink">Valuations</h2>
              <p className="text-sm text-muted">What your stake is worth on a date. The latest one sets the current value; until you add one, the holding is held at cost.</p>
            </div>
            {h.status === "active" ? (
              <ValuationForm onAdd={(data) => mutate(() => api.addValuation(h.id, data), "Valuation added.")} minDate={h.investment_date} />
            ) : (
              <p className="text-sm text-muted">This holding is {h.status === "exited" ? "exited" : "written off"}, so it no longer carries a value.</p>
            )}
            {detail.valuations.length === 0 ? (
              <p className="text-sm text-muted">No valuations recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {detail.valuations.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-ink">{SOURCE_LABEL[v.source]}</div>
                      <div className="truncate text-xs text-muted">
                        {formatDate(v.valuation_date)}
                        {v.note && ` · ${v.note}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-ink">{formatCurrency(v.value)}</span>
                      <button
                        type="button"
                        aria-label={`Delete valuation of ${formatCurrency(v.value)}`}
                        className="rounded-md p-1 text-faint hover:bg-subtle hover:text-danger"
                        onClick={() => {
                          if (window.confirm("Delete this valuation?")) mutate(() => api.deleteValuation(v.id), "Valuation deleted.");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {h.notes && (
          <Card>
            <h2 className="font-sans text-sm font-medium text-muted">Notes</h2>
            <p className="mt-1.5 whitespace-pre-line text-sm text-ink-2">{h.notes}</p>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

function Figure({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "positive" | "danger" | "neutral" }) {
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className={cx("figure mt-2 text-2xl leading-none font-medium", tone === "positive" ? "text-positive" : tone === "danger" ? "text-danger" : "text-ink")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

function TransactionForm({
  onAdd,
  minDate,
}: {
  onAdd: (data: { txn_date: string; type: TransactionType; amount: string; status: "completed" | "pending"; description: string }) => Promise<boolean>;
  minDate: string;
}) {
  const [type, setType] = useState<TransactionType>("dividend");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = amount ? cleanMoneyInput(amount) : null;
    if (!clean || toNumber(clean) <= 0) return setError("Enter an amount like 2500 or 2500.50.");
    setError(null);
    setSaving(true);
    const ok = await onAdd({ txn_date: date, type, amount: clean, status: pending ? "pending" : "completed", description: description.trim() });
    setSaving(false);
    if (ok) {
      setAmount(null);
      setDescription("");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-canvas p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" htmlFor="tx-type">
          <select id="tx-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            {(Object.keys(TXN_LABEL) as TransactionType[]).filter((t) => t !== "investment").map((t) => (
              <option key={t} value={t}>
                {TXN_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor="tx-date">
          <input id="tx-date" type="date" required min={type === "fee" ? undefined : minDate} max={todayISO()} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Amount" htmlFor="tx-amount">
          <MoneyInput id="tx-amount" value={amount} onChange={setAmount} required />
        </Field>
      </div>
      <input aria-label="Note" placeholder="Note (optional)" maxLength={500} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} className="h-4 w-4" />
          Pending (not yet settled; not counted in totals)
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add transaction"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

function ValuationForm({
  onAdd,
  minDate,
}: {
  onAdd: (data: { valuation_date: string; value: string; source: ValuationSource; note: string }) => Promise<boolean>;
  minDate: string;
}) {
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState<string | null>(null);
  const [source, setSource] = useState<ValuationSource>("self_reported");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = value ? cleanMoneyInput(value) : null;
    if (clean == null) return setError("Enter what your stake is worth, like 120000.");
    setError(null);
    setSaving(true);
    const ok = await onAdd({ valuation_date: date, value: clean, source, note: note.trim() });
    setSaving(false);
    if (ok) {
      setValue(null);
      setNote("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-canvas p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Value of your stake" htmlFor="val-value">
          <MoneyInput id="val-value" value={value} onChange={setValue} required />
        </Field>
        <Field label="As of" htmlFor="val-date">
          <input id="val-date" type="date" required min={minDate} max={todayISO()} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Source" htmlFor="val-source">
          <select id="val-source" className={inputClass} value={source} onChange={(e) => setSource(e.target.value as ValuationSource)}>
            {(Object.keys(SOURCE_LABEL) as ValuationSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <input aria-label="Valuation note" placeholder="Note (optional)" maxLength={500} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add valuation"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
