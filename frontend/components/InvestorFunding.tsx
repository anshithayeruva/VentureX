"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Notice } from "@/components/forms";
import { AllocationStatusTag, FundingOverview, OwnershipCell, RoundStatusTag, allocationAmount, roundTerms } from "@/components/funding";
import { Button, ButtonLink, Card, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cleanMoneyInput, formatCompact, formatCurrency } from "@/lib/money";
import type { FundingRound, PortfolioAllocation } from "@/types";

/** On a startup's page: its open round, disclosed progress, and the investor's own allocation. */
export function InvestorRoundsCard({ projectId, canContact }: { projectId: number; canContact: boolean }) {
  const [data, setData] = useState<{ rounds: FundingRound[]; can_propose: boolean } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => api.getInvestorRounds(projectId).then(setData).catch(() => setData({ rounds: [], can_propose: false })), [projectId]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ text: ok, ok: true });
      await load();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (!data || data.rounds.length === 0) return null;
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Landmark className="h-4 w-4 text-accent" />
        Funding round
      </div>
      {notice && <Notice {...notice} />}
      {data.rounds.map((r) => {
        const mine = r.allocations.find((a) => !["rejected", "cancelled"].includes(a.status));
        const closedOut = r.allocations.find((a) => ["rejected", "cancelled"].includes(a.status));
        return (
          <div key={r.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink">{r.name}</span>
              <RoundStatusTag status={r.status} />
            </div>
            <p className="text-xs text-muted">{roundTerms(r)}</p>
            <FundingOverview summary={r.summary} />
            {mine ? (
              <div className="space-y-2 rounded-lg border border-line px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink">Your investment: {formatCurrency(allocationAmount(mine))}</span>
                  <AllocationStatusTag status={mine.status} />
                </div>
                {mine.status === "accepted" && (
                  <>
                    <p className="text-muted">
                      The founders agreed {formatCurrency(mine.committed_amount)}
                      {mine.agreed_equity_pct ? ` for ${Number(mine.agreed_equity_pct)}% equity` : ""}
                      {mine.terms ? `. Terms: ${mine.terms}` : ""}. Confirming commits this capital.
                    </p>
                    <div className="flex gap-2">
                      <Button disabled={busy} onClick={() => run(() => api.confirmAllocation(mine.id), "Committed.")}>Confirm commitment</Button>
                      <Button variant="ghost" disabled={busy} onClick={() => run(() => api.withdrawAllocation(mine.id), "Withdrawn.")}>Withdraw</Button>
                    </div>
                  </>
                )}
                {mine.status === "proposed" && (
                  <Button variant="ghost" disabled={busy} onClick={() => run(() => api.withdrawAllocation(mine.id), "Proposal withdrawn.")}>Withdraw proposal</Button>
                )}
                {["committed", "partially_funded", "funded"].includes(mine.status) && (
                  <Link href={`/investor/allocations/${mine.id}`} className="text-accent hover:underline">View details and payments</Link>
                )}
              </div>
            ) : r.status === "open" ? (
              !canContact ? (
                <ButtonLink href="/investor/verification" variant="secondary">Get verified to invest</ButtonLink>
              ) : !data.can_propose ? (
                <p className="text-sm text-muted">Connect with the founders first (an accepted intro) to propose an investment.</p>
              ) : (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const amt = cleanMoneyInput(amount);
                    if (!amt) return setNotice({ text: "Enter an amount in rupees.", ok: false });
                    run(() => api.proposeInvestment(r.id, amt, note), "Proposal sent. The founders will review it.");
                  }}
                >
                  {closedOut && <p className="text-xs text-muted">Your earlier proposal was {closedOut.status === "rejected" ? "declined" : "withdrawn"}{closedOut.founder_note ? `: “${closedOut.founder_note}”` : ""}.</p>}
                  <Field label="Propose an investment (₹)" htmlFor={`pr-${r.id}`} hint={r.min_ticket || r.max_ticket ? `Tickets ${r.min_ticket ? formatCompact(r.min_ticket) : "any"} to ${r.max_ticket ? formatCompact(r.max_ticket) : "any"}` : undefined}>
                    <input id={`pr-${r.id}`} inputMode="decimal" required className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  <input aria-label="Note to the founders" placeholder="Note to the founders (optional)" maxLength={1000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send proposal"}</Button>
                  <p className="text-xs text-faint">A proposal isn&apos;t a commitment. You confirm once the founders agree terms.</p>
                </form>
              )
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}

/** In the portfolio: every round the investor is in, with their own figures. */
export function RoundAllocationsPanel() {
  const [items, setItems] = useState<PortfolioAllocation[] | null>(null);
  useEffect(() => {
    let active = true;
    api.getMyAllocations().then((d) => active && setItems(d)).catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <Card padded={false} className="mb-6" id="rounds">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-lg text-ink">Funding rounds on VentureX</h2>
        <p className="text-sm text-muted">Your allocations in founders&apos; rounds: what you committed and what the founders have recorded as received. Kept separately from the holdings you record yourself below.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Startup · round</th>
              <th className="px-4 py-2 text-right font-medium">Your amount</th>
              <th className="px-4 py-2 text-right font-medium">Received</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Equity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/investor/allocations/${a.id}`} className="text-ink hover:underline">{a.project_title}</Link>
                  <div className="text-xs text-muted">{a.round_name}</div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(allocationAmount(a))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(a.received)}</td>
                <td className="px-4 py-2.5"><AllocationStatusTag status={a.status} /></td>
                <td className="px-4 py-2.5"><OwnershipCell ownership={a.ownership} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
