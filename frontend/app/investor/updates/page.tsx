"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HandHelping, Inbox, MessageSquare, Wallet } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice, Pagination } from "@/components/forms";
import { Button, Card, EmptyState, LoadingRows, PageHeader, Segmented, cx, inputClass } from "@/components/ui";
import { MetricsGrid, TextSection } from "@/components/updates";
import { api } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/format";
import type { InvestorUpdateItem, InvestorUpdatesPage } from "@/types";

function InvestorUpdatesContent() {
  const params = useSearchParams();
  const focus = params.get("update") ? Number(params.get("update")) : null;
  const projectFilter = params.get("project") ? Number(params.get("project")) : undefined;
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvestorUpdatesPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getInvestorUpdates({ unread_only: filter === "unread", page, project_id: projectFilter })
      .then((d) => active && setData(d))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Couldn't load updates."));
    return () => {
      active = false;
    };
  }, [filter, page, projectFilter, nonce]);

  const patch = useCallback(
    (id: number, p: Partial<InvestorUpdateItem>) =>
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) } : d)),
    []
  );

  return (
    <PortalLayout role="INVESTOR" activeItem="updates" title="Updates">
      <PageHeader
        title="Company updates"
        description="Monthly and quarterly updates from the companies you've invested in or are connected with. Reply to their asks, and keep your holdings' values current."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={(v) => { setFilter(v); setPage(1); }}
          options={[
            { value: "all", label: `All${data ? ` ${filter === "all" ? data.total : ""}` : ""}`.trim() },
            { value: "unread", label: `Unread${data ? ` ${data.unread}` : ""}` },
          ]}
        />
        {projectFilter && data?.items[0] && (
          <Link href="/investor/updates" className="text-sm text-accent hover:underline">
            Showing {data.items[0].project_title} only · show all
          </Link>
        )}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); setNonce((n) => n + 1); }} />
      ) : !data ? (
        <LoadingRows />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === "unread" ? "You're all caught up" : "No updates yet"}
          description={filter === "unread" ? undefined : "Companies' updates arrive here once you've recorded your investment in them, or connected through an intro."}
        />
      ) : (
        <div className="space-y-4">
          {data.items.map((item) => (
            <UpdateCard key={item.id} item={item} focused={focus === item.id} onPatch={(p) => patch(item.id, p)} />
          ))}
          <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
        </div>
      )}
    </PortalLayout>
  );
}

function UpdateCard({ item, focused, onPatch }: { item: InvestorUpdateItem; focused: boolean; onPatch: (p: Partial<InvestorUpdateItem>) => void }) {
  const [open, setOpen] = useState(focused || !item.read_at);
  const [replyTo, setReplyTo] = useState<number | "general" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);

  // Opening an unread update marks it read.
  useEffect(() => {
    if (open && !item.read_at) {
      api.markUpdateRead(item.id).then(() => onPatch({ read_at: new Date().toISOString() })).catch(() => undefined);
    }
  }, [open, item.read_at, item.id, onPatch]);

  const reply = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const askIndex = replyTo === "general" ? null : replyTo;
      const r = await api.replyToUpdate(item.id, message.trim(), askIndex);
      onPatch({ my_responses: [...item.my_responses, { ...r, ask_index: askIndex }] });
      setMessage("");
      setReplyTo(null);
      setNotice({ text: "Sent to the founder.", ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't send your reply.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const applyValuation = async () => {
    if (!item.holding) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.applyUpdateValuation(item.id, item.holding.investment_id);
      setNotice({ text: `Your holding is now valued at ${formatMoney(item.holding.suggested_value)} (company report).`, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't update the holding.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const composer = (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <input
        aria-label="Your reply"
        autoFocus
        maxLength={2000}
        placeholder={replyTo === "general" ? "Your reply to the founder" : "How you can help"}
        className={inputClass}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex shrink-0 gap-2">
        <Button onClick={reply} disabled={busy || message.trim().length < 2}>{busy ? "Sending…" : "Send"}</Button>
        <Button variant="ghost" onClick={() => { setReplyTo(null); setMessage(""); }}>Cancel</Button>
      </div>
    </div>
  );

  const pm = item.metrics.post_money_valuation;
  return (
    <div ref={ref}>
      <Card className={cx("min-w-0", focused && "ring-2 ring-accent/30")}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {!item.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              <span className="font-medium text-ink">{item.project_title}</span>
              <span className="text-muted">· {item.period_label}</span>
            </div>
            {!open && <div className="line-clamp-1 text-sm text-muted">{item.highlights || item.challenges}</div>}
          </div>
          <span className="shrink-0 text-xs text-faint">{item.sent_at ? timeAgo(item.sent_at) : ""}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-5">
            {notice && <Notice {...notice} />}
            <MetricsGrid metrics={item.metrics} previous={item.previous?.metrics} previousLabel={item.previous?.period_label} />
            {item.holding && pm != null && (
              <div className="flex flex-col gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-accent sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                  {item.holding.suggested_value != null
                    ? `New post-money of ${formatMoney(Number(pm))}: your ${item.holding.ownership_pct}% would be worth ${formatMoney(item.holding.suggested_value)}.`
                    : "This update reports a new valuation. Add your ownership % to the holding to value it."}
                </span>
                {item.holding.suggested_value != null ? (
                  <Button variant="secondary" className="shrink-0" onClick={applyValuation} disabled={busy}>Update my holding</Button>
                ) : (
                  <Link className="shrink-0 font-medium underline" href={`/investor/portfolio/${item.holding.investment_id}`}>Open holding</Link>
                )}
              </div>
            )}
            <TextSection title="Highlights" body={item.highlights} />
            <TextSection title="Challenges" body={item.challenges} />
            {item.asks.length > 0 && (
              <div>
                <h3 className="font-sans text-sm font-medium text-muted">Asks</h3>
                <ol className="mt-2 space-y-2">
                  {item.asks.map((a, i) => {
                    const mine = item.my_responses.filter((r) => r.ask_index === i);
                    return (
                      <li key={i} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-ink">{i + 1}. {a}</span>
                          {replyTo !== i && (
                            <Button variant="ghost" className="shrink-0" onClick={() => { setReplyTo(i); setMessage(""); }}>
                              <HandHelping className="h-4 w-4" />
                              I can help
                            </Button>
                          )}
                        </div>
                        {mine.map((r) => (
                          <div key={r.id} className="mt-1 border-l-2 border-accent pl-3 text-sm text-ink-2">You: {r.message}</div>
                        ))}
                        {replyTo === i && composer}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            <div className="border-t border-line pt-3">
              {item.my_responses.filter((r) => r.ask_index == null).map((r) => (
                <div key={r.id} className="mb-2 border-l-2 border-accent pl-3 text-sm text-ink-2">You: {r.message}</div>
              ))}
              {replyTo === "general" ? (
                composer
              ) : (
                <Button variant="ghost" onClick={() => { setReplyTo("general"); setMessage(""); }}>
                  <MessageSquare className="h-4 w-4" />
                  Reply to the founder
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function InvestorUpdatesPage() {
  return (
    <Suspense fallback={null}>
      <InvestorUpdatesContent />
    </Suspense>
  );
}
