"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Landmark, Plus } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { AllocationStatusTag, FundingOverview, OwnershipCell, RoundStatusTag, allocationAmount, roundTerms } from "@/components/funding";
import { Button, Card, EmptyState, Field, LoadingRows, PageHeader, Tag, Toggle, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cleanMoneyInput, formatCompact, formatCurrency, formatDate, todayISO } from "@/lib/money";
import type { Allocation, FundingRound, ProjectFunding, RoundInput, RoundStatus } from "@/types";

const EMPTY_ROUND: RoundInput = {
  name: "", round_type: "seed", instrument: "equity", target_amount: "", min_ticket: "", max_ticket: "",
  pre_money_valuation: "", post_money_valuation: "", valuation_cap: "", discount_pct: "", opens_on: "", closes_on: "",
  disclose_progress: true,
};

const money = (v?: string | null) => (v ? cleanMoneyInput(v) : null);

function toPayload(r: RoundInput): RoundInput | string {
  const target = money(r.target_amount);
  if (!r.name.trim()) return "Give the round a name.";
  if (!target) return "Enter the round's target in rupees.";
  const out: RoundInput = { ...r, name: r.name.trim(), target_amount: target };
  for (const k of ["min_ticket", "max_ticket", "pre_money_valuation", "post_money_valuation", "valuation_cap"] as const) {
    if (r[k]) {
      const v = money(r[k]);
      if (!v) return "Amounts must be numbers with up to 2 decimals.";
      out[k] = v;
    } else out[k] = null;
  }
  out.discount_pct = r.discount_pct ? r.discount_pct : null;
  out.opens_on = r.opens_on || null;
  out.closes_on = r.closes_on || null;
  if (r.instrument === "equity") { out.valuation_cap = null; out.discount_pct = null; }
  return out;
}

export default function FundingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const [data, setData] = useState<ProjectFunding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () => api.getProjectFunding(projectId).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load funding.")),
    [projectId]
  );
  useEffect(() => {
    load();
  }, [load]);

  const hasActive = data?.rounds.some((r) => r.status === "draft" || r.status === "open");

  return (
    <PortalLayout role="FOUNDER" activeItem="projects" title="Funding">
      <Link href={`/founder/projects/${projectId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        {data?.project.title ?? "Project"}
      </Link>
      <PageHeader
        title="Funding"
        description="Your rounds, what each investor has committed, and how much capital has actually arrived. Expressing interest isn't an investment: only confirmed commitments count, and only recorded receipts count as received."
        actions={data && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New round
          </Button>
        )}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !data ? (
        <LoadingRows />
      ) : (
        <div className="space-y-6">
          {creating && (
            <RoundForm
              initial={{ ...EMPTY_ROUND, target_amount: data.project.funding_required && !hasActive ? String(Number(data.project.funding_required)) : "" }}
              onCancel={() => setCreating(false)}
              onSubmit={async (payload) => { setData(await api.createRound(projectId, payload)); setCreating(false); }}
              submitLabel="Create round"
            />
          )}
          {data.rounds.length === 0 && !creating ? (
            <EmptyState
              icon={Landmark}
              title="No funding rounds yet"
              description="Create a round to set your target, ticket sizes and terms. Investors you're connected with can then propose an investment, and you track commitments and money received here."
              action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create a round</Button>}
            />
          ) : (
            data.rounds.map((r) => <RoundCard key={r.id} round={r} onChange={setData} />)
          )}
        </div>
      )}
    </PortalLayout>
  );
}

function RoundForm({ initial, onSubmit, onCancel, submitLabel }: { initial: RoundInput; onSubmit: (r: RoundInput) => Promise<void>; onCancel: () => void; submitLabel: string }) {
  const [f, setF] = useState<RoundInput>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<RoundInput>) => setF((x) => ({ ...x, ...patch }));
  const convertible = f.instrument === "safe" || f.instrument === "convertible_note";
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = toPayload(f);
          if (typeof p === "string") return setErr(p);
          setBusy(true);
          setErr(null);
          try {
            await onSubmit(p);
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : "Couldn't save the round.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg text-ink">{submitLabel === "Create round" ? "New funding round" : "Edit round"}</h2>
        {err && <Notice ok={false} text={err} />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Round name" htmlFor="rf-name"><input id="rf-name" required maxLength={80} placeholder="e.g. Seed 2026" className={inputClass} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Round type" htmlFor="rf-type">
            <select id="rf-type" className={inputClass} value={f.round_type} onChange={(e) => set({ round_type: e.target.value })}>
              {[["pre_seed", "Pre-seed"], ["seed", "Seed"], ["series_a", "Series A"], ["series_b", "Series B"], ["series_c", "Series C"], ["bridge", "Bridge"], ["other", "Other"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Instrument" htmlFor="rf-inst">
            <select id="rf-inst" className={inputClass} value={f.instrument} onChange={(e) => set({ instrument: e.target.value as RoundInput["instrument"] })}>
              <option value="equity">Priced equity</option>
              <option value="safe">SAFE</option>
              <option value="convertible_note">Convertible note</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Funding target (₹)" htmlFor="rf-target"><input id="rf-target" required inputMode="decimal" className={inputClass} value={f.target_amount} onChange={(e) => set({ target_amount: e.target.value })} /></Field>
          <Field label="Minimum ticket (₹)" htmlFor="rf-min"><input id="rf-min" inputMode="decimal" className={inputClass} value={f.min_ticket ?? ""} onChange={(e) => set({ min_ticket: e.target.value })} /></Field>
          <Field label="Maximum ticket (₹)" htmlFor="rf-max"><input id="rf-max" inputMode="decimal" className={inputClass} value={f.max_ticket ?? ""} onChange={(e) => set({ max_ticket: e.target.value })} /></Field>
          {convertible ? (
            <>
              <Field label="Valuation cap (₹)" htmlFor="rf-cap"><input id="rf-cap" inputMode="decimal" className={inputClass} value={f.valuation_cap ?? ""} onChange={(e) => set({ valuation_cap: e.target.value })} /></Field>
              <Field label="Discount (%)" htmlFor="rf-disc"><input id="rf-disc" inputMode="decimal" className={inputClass} value={f.discount_pct ?? ""} onChange={(e) => set({ discount_pct: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="Pre-money valuation (₹)" htmlFor="rf-pre" hint="Used for indicative ownership"><input id="rf-pre" inputMode="decimal" className={inputClass} value={f.pre_money_valuation ?? ""} onChange={(e) => set({ pre_money_valuation: e.target.value })} /></Field>
              <Field label="Post-money valuation (₹)" htmlFor="rf-post" hint="If already fixed"><input id="rf-post" inputMode="decimal" className={inputClass} value={f.post_money_valuation ?? ""} onChange={(e) => set({ post_money_valuation: e.target.value })} /></Field>
            </>
          )}
          <Field label="Opens on" htmlFor="rf-open"><input id="rf-open" type="date" className={inputClass} value={f.opens_on ?? ""} onChange={(e) => set({ opens_on: e.target.value })} /></Field>
          <Field label="Closes on" htmlFor="rf-close"><input id="rf-close" type="date" className={inputClass} value={f.closes_on ?? ""} onChange={(e) => set({ closes_on: e.target.value })} /></Field>
        </div>
        <Toggle label="Show round progress to investors" description="Investors see the committed total and progress (never other investors' amounts). Off: they see only the target."
          checked={f.disclose_progress} onChange={(v) => set({ disclose_progress: v })} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}

function RoundCard({ round, onChange }: { round: FundingRound; onChange: (d: ProjectFunding) => void }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showExternal, setShowExternal] = useState(false);

  const act = async (fn: () => Promise<ProjectFunding>, ok: string) => {
    setBusy(true);
    setNotice(null);
    try {
      onChange(await fn());
      setNotice({ text: ok, ok: true });
      return true;
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const status = (s: RoundStatus, label: string) => (
    <Button variant="secondary" disabled={busy} onClick={() => {
      if (s === "cancelled" && !window.confirm("Cancel this round?")) return;
      act(() => api.setRoundStatus(round.id, s), `Round ${label.toLowerCase()}.`);
    }}>{label}</Button>
  );

  if (editing) {
    const init: RoundInput = {
      name: round.name, round_type: round.round_type, instrument: round.instrument,
      target_amount: String(Number(round.target_amount)), min_ticket: round.min_ticket ? String(Number(round.min_ticket)) : "",
      max_ticket: round.max_ticket ? String(Number(round.max_ticket)) : "", pre_money_valuation: round.pre_money_valuation ? String(Number(round.pre_money_valuation)) : "",
      post_money_valuation: round.post_money_valuation ? String(Number(round.post_money_valuation)) : "", valuation_cap: round.valuation_cap ? String(Number(round.valuation_cap)) : "",
      discount_pct: round.discount_pct ? String(Number(round.discount_pct)) : "", opens_on: round.opens_on ?? "", closes_on: round.closes_on ?? "", disclose_progress: round.disclose_progress,
    };
    return <RoundForm initial={init} submitLabel="Save round" onCancel={() => setEditing(false)} onSubmit={async (p) => { onChange(await api.updateRound(round.id, p)); setEditing(false); }} />;
  }

  const negotiating = round.allocations.filter((a) => a.status === "proposed" || a.status === "accepted");
  const table = round.allocations.filter((a) => !["proposed", "accepted"].includes(a.status));
  const s = round.summary;

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl text-ink">{round.name}</h2>
            <RoundStatusTag status={round.status} />
            {!round.disclose_progress && <Tag>Progress private</Tag>}
          </div>
          <p className="mt-1 text-sm text-muted">{roundTerms(round)}</p>
          {(round.opens_on || round.closes_on) && <p className="text-xs text-faint">{round.opens_on ? `Opens ${formatDate(round.opens_on)}` : ""}{round.opens_on && round.closes_on ? " · " : ""}{round.closes_on ? `Closes ${formatDate(round.closes_on)}` : ""}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {round.status !== "cancelled" && round.status !== "closed" && <Button variant="ghost" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>}
          {round.status === "draft" && status("open", "Open")}
          {round.status === "open" && status("closed", "Close")}
          {round.status === "closed" && status("open", "Reopen")}
          {(round.status === "draft" || round.status === "open") && status("cancelled", "Cancel round")}
        </div>
      </div>
      {notice && <Notice {...notice} />}
      <FundingOverview summary={s} />

      {(round.combined_agreed_equity_pct || round.combined_indicative_equity_pct || round.indicative_post_money) && (
        <p className="text-sm text-muted">
          {round.combined_agreed_equity_pct && <>Agreed equity across committed investors: <span className="text-ink">{Number(round.combined_agreed_equity_pct)}%</span>. </>}
          {round.combined_indicative_equity_pct && <>Indicative equity for all {formatCompact(s.committed)} committed: <span className="text-ink">~{Number(round.combined_indicative_equity_pct).toFixed(2)}%</span> at an indicative post-money of {formatCompact(round.indicative_post_money)} (pre-money plus committed capital; not agreed terms).</>}
        </p>
      )}

      {negotiating.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-sans text-sm font-medium text-ink">In negotiation (not counted as committed)</h3>
          {negotiating.map((a) => <Proposal key={a.id} alloc={a} round={round} act={act} busy={busy} />)}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-sans text-sm font-medium text-ink">Investor allocations</h3>
          {round.status !== "cancelled" && <Button variant="ghost" onClick={() => setShowExternal((v) => !v)}><Plus className="h-4 w-4" />Record an outside investor</Button>}
        </div>
        {showExternal && <ExternalForm round={round} act={act} onDone={() => setShowExternal(false)} />}
        {table.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No commitments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Investor</th>
                  <th className="px-3 py-2 text-right font-medium">Committed</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Equity</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Committed on</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.map((a) => <AllocationRow key={a.id} alloc={a} act={act} busy={busy} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

type Act = (fn: () => Promise<ProjectFunding>, ok: string) => Promise<boolean>;

function Proposal({ alloc, round, act, busy }: { alloc: Allocation; round: FundingRound; act: Act; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Number(alloc.proposed_amount ?? 0)));
  const [equity, setEquity] = useState("");
  const [valuation, setValuation] = useState("");
  const [terms, setTerms] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="font-medium text-ink">{alloc.investor_name}</span>
          {alloc.investor_firm && <span className="text-muted"> · {alloc.investor_firm}</span>}
          <div className="text-sm text-muted">
            {alloc.status === "proposed" ? "Proposed" : "Agreed"} {formatCurrency(allocationAmount(alloc))} · {formatDate(alloc.created_at)}
            {alloc.investor_note && <> · “{alloc.investor_note}”</>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AllocationStatusTag status={alloc.status} />
          {alloc.status === "proposed" && !open && <Button onClick={() => setOpen(true)} disabled={busy}>Review</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => act(() => api.rejectAllocation(alloc.id, note), "Proposal declined.")}>Decline</Button>
        </div>
      </div>
      {alloc.status === "accepted" && <p className="mt-1 text-xs text-muted">Waiting for the investor to confirm. It counts as committed once they do.</p>}
      {open && (
        <form
          className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const amt = cleanMoneyInput(amount);
            if (!amt) return;
            const ok = await act(() => api.acceptAllocation(alloc.id, {
              amount: amt, agreed_equity_pct: equity || null, agreed_valuation: valuation ? cleanMoneyInput(valuation) : null, terms, note,
            }), "Terms sent to the investor to confirm.");
            if (ok) setOpen(false);
          }}
        >
          <Field label="Agreed amount (₹)" htmlFor={`ac-amt-${alloc.id}`}><input id={`ac-amt-${alloc.id}`} required inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          {alloc.instrument === "equity" ? (
            <Field label="Agreed equity (%)" htmlFor={`ac-eq-${alloc.id}`} hint="Leave empty if not negotiated"><input id={`ac-eq-${alloc.id}`} inputMode="decimal" className={inputClass} value={equity} onChange={(e) => setEquity(e.target.value)} /></Field>
          ) : (
            <Field label="Valuation cap (₹)" htmlFor={`ac-cap-${alloc.id}`} hint={round.valuation_cap ? `Round cap: ${formatCompact(round.valuation_cap)}` : undefined}><input id={`ac-cap-${alloc.id}`} inputMode="decimal" className={inputClass} value={valuation} onChange={(e) => setValuation(e.target.value)} /></Field>
          )}
          {alloc.instrument === "equity" && (
            <Field label="Agreed pre-money (₹)" htmlFor={`ac-val-${alloc.id}`} hint="If different from the round's"><input id={`ac-val-${alloc.id}`} inputMode="decimal" className={inputClass} value={valuation} onChange={(e) => setValuation(e.target.value)} /></Field>
          )}
          <Field label="Note to the investor" htmlFor={`ac-note-${alloc.id}`}><input id={`ac-note-${alloc.id}`} maxLength={1000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="sm:col-span-2 lg:col-span-4"><Field label="Other terms" htmlFor={`ac-terms-${alloc.id}`}><textarea id={`ac-terms-${alloc.id}`} rows={2} maxLength={2000} className={inputClass} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field></div>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>Accept these terms</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function AllocationRow({ alloc, act, busy }: { alloc: Allocation; act: Act; busy: boolean }) {
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(alloc.outstanding && Number(alloc.outstanding) > 0 ? String(Number(alloc.outstanding)) : "");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [type, setType] = useState<"receipt" | "refund">("receipt");
  const counted = ["committed", "partially_funded", "funded"].includes(alloc.status);
  return (
    <>
      <tr className={cx(!counted && "text-muted")}>
        <td className="px-3 py-2.5">
          <div className="text-ink">{alloc.investor_name}{alloc.external && <span className="ml-1.5"><Tag>Recorded by you</Tag></span>}</div>
          {alloc.investor_firm && <div className="text-xs text-muted">{alloc.investor_firm}</div>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(alloc.committed_amount)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(alloc.received)}{counted && alloc.outstanding && Number(alloc.outstanding) > 0 && <div className="text-xs text-muted">{formatCompact(alloc.outstanding)} outstanding</div>}</td>
        <td className="px-3 py-2.5"><AllocationStatusTag status={alloc.status} /></td>
        <td className="px-3 py-2.5"><OwnershipCell ownership={alloc.ownership} /></td>
        <td className="px-3 py-2.5">{alloc.instrument === "equity" ? "Equity" : alloc.instrument === "safe" ? "SAFE" : alloc.instrument === "convertible_note" ? "Convertible note" : "Other"}</td>
        <td className="px-3 py-2.5">{formatDate(alloc.committed_on)}</td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          {counted && <Button variant="ghost" onClick={() => setPaying((v) => !v)} disabled={busy}>Record payment</Button>}
          {counted && Number(alloc.received) === 0 && (
            <Button variant="ghost" disabled={busy} onClick={() => window.confirm("Cancel this commitment?") && act(() => api.cancelCommitment(alloc.id), "Commitment cancelled.")}>Cancel</Button>
          )}
        </td>
      </tr>
      {paying && (
        <tr>
          <td colSpan={8} className="bg-canvas/60 px-3 py-3">
            <form
              className="flex flex-col gap-2 lg:flex-row lg:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                const amt = cleanMoneyInput(amount);
                if (!amt) return;
                if (await act(() => api.recordReceipt(alloc.id, { amount: amt, received_on: date, reference, type }), type === "receipt" ? "Payment recorded." : "Refund recorded.")) setPaying(false);
              }}
            >
              <Field label="Type" htmlFor={`rc-type-${alloc.id}`}>
                <select id={`rc-type-${alloc.id}`} className={inputClass} value={type} onChange={(e) => setType(e.target.value as "receipt" | "refund")}>
                  <option value="receipt">Capital received</option>
                  <option value="refund">Refund</option>
                </select>
              </Field>
              <Field label="Amount (₹)" htmlFor={`rc-amt-${alloc.id}`}><input id={`rc-amt-${alloc.id}`} required inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Date" htmlFor={`rc-date-${alloc.id}`}><input id={`rc-date-${alloc.id}`} type="date" max={todayISO()} required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Reference (e.g. UTR)" htmlFor={`rc-ref-${alloc.id}`}><input id={`rc-ref-${alloc.id}`} maxLength={200} className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>Save</Button>
                <Button variant="ghost" onClick={() => setPaying(false)}>Cancel</Button>
              </div>
            </form>
            <p className="mt-2 text-xs text-muted">VentureX doesn&apos;t move money; this records a transfer you received outside the platform. The investor sees it and can confirm it.</p>
          </td>
        </tr>
      )}
    </>
  );
}

function ExternalForm({ round, act, onDone }: { round: FundingRound; act: Act; onDone: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [equity, setEquity] = useState("");
  const [date, setDate] = useState(todayISO());
  return (
    <form
      className="grid gap-3 rounded-lg border border-line bg-canvas/60 p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const amt = cleanMoneyInput(amount);
        if (!amt) return;
        if (await act(() => api.addExternalAllocation(round.id, { investor_name: name, amount: amt, agreed_equity_pct: equity || null, committed_on: date }), "Commitment recorded.")) onDone();
      }}
    >
      <Field label="Investor or organization" htmlFor={`ex-name-${round.id}`}><input id={`ex-name-${round.id}`} required minLength={2} maxLength={120} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Committed amount (₹)" htmlFor={`ex-amt-${round.id}`}><input id={`ex-amt-${round.id}`} required inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {round.instrument === "equity" && <Field label="Agreed equity (%)" htmlFor={`ex-eq-${round.id}`}><input id={`ex-eq-${round.id}`} inputMode="decimal" className={inputClass} value={equity} onChange={(e) => setEquity(e.target.value)} /></Field>}
      <Field label="Committed on" htmlFor={`ex-date-${round.id}`}><input id={`ex-date-${round.id}`} type="date" max={todayISO()} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="flex gap-2"><Button type="submit">Record</Button><Button variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}
