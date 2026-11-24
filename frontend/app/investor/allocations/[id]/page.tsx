"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileQuestion } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { AllocationStatusTag, FundingOverview, INSTRUMENT_NAME, OwnershipCell, allocationAmount, roundTerms } from "@/components/funding";
import { Button, ButtonLink, Card, EmptyState, LoadingRows, PageHeader, Tag } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTimePref } from "@/lib/displayPrefs";
import { formatCompact, formatCurrency, formatDate } from "@/lib/money";
import type { AllocationDetail } from "@/types";

const ACTION: Record<string, string> = {
  proposed: "You proposed an investment",
  accepted: "The founders accepted and set terms",
  committed: "You confirmed: capital committed",
  rejected: "The founders declined",
  withdrawn: "You withdrew",
  cancelled_by_founder: "The founders cancelled the commitment",
  receipt: "Capital received (recorded by the founders)",
  refund: "Refund recorded",
  receipt_confirmed: "You confirmed a receipt",
};

export default function AllocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<AllocationDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api.getMyAllocation(Number(id))
        .then((d) => (d ? setData(d) : setMissing(true)))
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this investment.")),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<AllocationDetail>, ok: string) => {
    setBusy(true);
    setNotice(null);
    try {
      setData(await fn());
      setNotice({ text: ok, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalLayout role="INVESTOR" activeItem="portfolio" title="Investment">
      <Link href="/investor/portfolio#rounds" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Portfolio
      </Link>
      {missing ? (
        <EmptyState icon={FileQuestion} title="Investment not found" action={<ButtonLink href="/investor/portfolio">Back to portfolio</ButtonLink>} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !data ? (
        <LoadingRows />
      ) : (
        <Detail data={data} busy={busy} notice={notice} run={run} />
      )}
    </PortalLayout>
  );
}

function Detail({ data, busy, notice, run }: { data: AllocationDetail; busy: boolean; notice: { text: string; ok: boolean } | null; run: (fn: () => Promise<AllocationDetail>, ok: string) => void }) {
  const a = data.allocation;
  const r = data.round;
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.project.title}
        description={`${r.name} · ${roundTerms(r)}`}
        actions={<ButtonLink href={`/investor/projects/${data.project.id}`} variant="secondary">View startup</ButtonLink>}
      />
      {notice && <Notice {...notice} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg text-ink">Your investment</h2>
              <AllocationStatusTag status={a.status} />
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label={a.status === "proposed" ? "Proposed amount" : "Agreed amount"} value={formatCurrency(allocationAmount(a))} />
              <Row label="Received by the founders" value={formatCurrency(a.received)} />
              {a.outstanding && <Row label="Still to transfer" value={formatCurrency(a.outstanding)} />}
              <Row label="Instrument" value={INSTRUMENT_NAME[a.instrument]} />
              <Row label="Equity" value={<OwnershipCell ownership={a.ownership} />} />
              {a.agreed_valuation && <Row label={a.instrument === "equity" ? "Agreed pre-money" : "Valuation cap"} value={formatCompact(a.agreed_valuation)} />}
              {a.discount_pct && <Row label="Discount" value={`${Number(a.discount_pct)}%`} />}
              <Row label="Committed on" value={formatDate(a.committed_on)} />
            </dl>
            {a.ownership.basis && <p className="text-xs text-muted">{a.ownership.basis}</p>}
            {a.terms && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">Terms: {a.terms}</p>}
            {a.founder_note && <p className="text-sm text-muted">Founders&apos; note: “{a.founder_note}”</p>}
            {a.status === "accepted" && (
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => run(() => api.confirmAllocation(a.id), "Committed.")}>Confirm commitment</Button>
                <Button variant="ghost" disabled={busy} onClick={() => run(() => api.withdrawAllocation(a.id), "Withdrawn.")}>Withdraw</Button>
              </div>
            )}
            {a.status === "proposed" && <Button variant="ghost" disabled={busy} onClick={() => run(() => api.withdrawAllocation(a.id), "Proposal withdrawn.")}>Withdraw proposal</Button>}
          </Card>

          <Card padded={false}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg text-ink">Payments</h2>
              <p className="text-sm text-muted">Recorded by the founders when your transfer arrives. Confirm the ones that match.</p>
            </div>
            {data.transactions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.transactions.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="text-ink">{t.type === "receipt" ? "Received" : "Refunded"} {formatCurrency(t.amount)}</span>
                      <span className="text-muted"> · {formatDate(t.received_on)}{t.reference ? ` · ref ${t.reference}` : ""}</span>
                    </span>
                    {t.investor_confirmed_at ? (
                      <Tag tone="positive"><CheckCircle2 className="h-3.5 w-3.5" />Confirmed by you</Tag>
                    ) : (
                      <Button variant="secondary" disabled={busy} onClick={() => run(() => api.confirmReceipt(t.id), "Receipt confirmed.")}>Confirm it matches</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="space-y-3">
            <h2 className="text-lg text-ink">Round</h2>
            {r.summary.committed === undefined && <p className="text-sm text-muted">The founders keep the round&apos;s progress private.</p>}
            <FundingOverview summary={r.summary} />
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg text-ink">History</h2>
            <ol className="space-y-2 text-sm">
              {data.history.map((h, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  <div className="text-ink">{ACTION[h.action] ?? h.action}</div>
                  <div className="text-xs text-muted">{formatDateTimePref(h.created_at)}{typeof h.details?.amount === "string" ? ` · ${formatCompact(h.details.amount as string)}` : ""}</div>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
