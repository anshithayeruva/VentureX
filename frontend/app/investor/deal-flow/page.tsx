"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Mail, MessagesSquare, Search, Wallet } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { Button, ButtonLink, Card, EmptyState, LoadingRows, PageHeader, Segmented, Tag, buttonClass, cx, inputClass } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { api } from "@/lib/api";
import { stageLabel, stageTone } from "@/lib/dealroom";
import { formatMoney, timeAgo } from "@/lib/format";
import type { DealFlow, DealFlowItem, DealFlowStatus } from "@/types";

type Filter = "all" | "saved" | "requested" | "active" | "closed" | "ended";

const STATUS: Record<DealFlowStatus, { label: string; tone: Tone }> = {
  saved: { label: "Saved", tone: "neutral" },
  requested: { label: "Intro requested", tone: "warning" },
  active: { label: "In progress", tone: "accent" },
  closed: { label: "Closed", tone: "positive" },
  declined: { label: "Founder declined", tone: "neutral" },
  passed: { label: "Passed", tone: "neutral" },
};

export default function DealFlowPage() {
  const [flow, setFlow] = useState<DealFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api
      .getDealFlow()
      .then(setFlow)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your deal flow."));
  }, []);
  useEffect(load, [load]);

  const flash = (text: string, ok = true) => {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), ok ? 4000 : 7000);
  };

  const run = async (item: DealFlowItem, action: () => Promise<unknown>, done: string) => {
    setBusy(item.project_id);
    try {
      await action();
      flash(done);
      load();
    } catch (err) {
      flash(err instanceof Error ? err.message : "That didn't work. Try again.", false);
    } finally {
      setBusy(null);
    }
  };

  const counts = flow?.counts ?? {};
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (flow?.items ?? []).filter((i) => {
      const inFilter =
        filter === "all" ||
        (filter === "ended" ? i.status === "declined" || i.status === "passed" : i.status === filter);
      const inSearch = !q || [i.title, i.industry, i.founder_name, i.founder_company].some((v) => v?.toLowerCase().includes(q));
      return inFilter && inSearch;
    });
  }, [flow, filter, query]);

  const total = flow?.items.length ?? 0;

  return (
    <PortalLayout role="INVESTOR" activeItem="dealflow" title="Deal Flow">
      <PageHeader
        title="Deal Flow"
        description="Every startup you're pursuing, from saved to closed. Deal rooms open here when a founder accepts your intro."
        actions={
          <ButtonLink href="/investor/discover" variant="secondary">
            <Search className="h-4 w-4" />
            Discover startups
          </ButtonLink>
        }
      />

      {notice && (
        <div className="mb-5">
          <Notice {...notice} />
        </div>
      )}

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !flow ? (
        <LoadingRows />
      ) : total === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing in your deal flow yet"
          description="Save startups or request intros from Discover. Founders who accept open a private deal room with you."
          action={<ButtonLink href="/investor/discover">Discover startups</ButtonLink>}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${total}` },
                  { value: "saved", label: `Saved ${counts.saved ?? 0}` },
                  { value: "requested", label: `Requested ${counts.requested ?? 0}` },
                  { value: "active", label: `Active ${counts.active ?? 0}` },
                  { value: "closed", label: `Closed ${counts.closed ?? 0}` },
                  { value: "ended", label: `Declined / passed ${(counts.declined ?? 0) + (counts.passed ?? 0)}` },
                ]}
              />
            </div>
            <input
              type="search"
              aria-label="Search deal flow"
              placeholder="Search"
              className={cx(inputClass, "lg:w-64")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState compact title="Nothing here" description="Try another filter." />
          ) : (
            <div className="space-y-3">
              {visible.map((item) => (
                <DealRow
                  key={item.project_id}
                  item={item}
                  busy={busy === item.project_id}
                  onRequest={() =>
                    run(
                      item,
                      () =>
                        api.expressInterest({
                          project_id: item.project_id,
                          project_title: item.title,
                          project_industry: item.industry ?? undefined,
                          message: `Interested in learning more about ${item.title}${item.stage ? ` and discussing the ${item.stage} round` : ""}.`,
                        }),
                      `Intro requested for ${item.title}.`
                    )
                  }
                  onUnsave={() => run(item, () => api.setSaved(item.project_id, false), `${item.title} removed from saved.`)}
                  onWithdraw={() =>
                    run(
                      item,
                      async () => {
                        if (!item.interest_id || !(await api.withdrawInterest(item.interest_id))) {
                          throw new Error("Couldn't withdraw the request.");
                        }
                      },
                      `Request for ${item.title} withdrawn.`
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}

function DealRow({
  item,
  busy,
  onRequest,
  onUnsave,
  onWithdraw,
}: {
  item: DealFlowItem;
  busy: boolean;
  onRequest: () => void;
  onUnsave: () => void;
  onWithdraw: () => void;
}) {
  const status = STATUS[item.status];
  const recordHref = `/investor/portfolio?record=${item.project_id}&company=${encodeURIComponent(item.title)}`;
  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/investor/projects/${item.project_id}`} className="text-sm font-medium text-ink hover:underline">
            {item.title}
          </Link>
          <div className="text-sm text-muted">
            {[item.stage, item.industry, item.funding_required ? `raising ${formatMoney(item.funding_required)}` : null]
              .filter(Boolean)
              .join(" · ")}
            {item.last_activity && <> · updated {timeAgo(item.last_activity)}</>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {item.deal_stage && item.status === "active" ? (
            <Tag tone={stageTone(item.deal_stage)}>{stageLabel(item.deal_stage)}</Tag>
          ) : (
            <Tag tone={status.tone}>{status.label}</Tag>
          )}
          {item.saved && item.status !== "saved" && (
            <Tag>
              <Bookmark className="h-3 w-3" />
              Saved
            </Tag>
          )}
        </div>
      </div>

      {item.status === "active" && item.last_message && (
        <p className="line-clamp-1 rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink-2">
          <span className="text-muted">Latest: </span>
          {item.last_message}
        </p>
      )}
      {item.response_note && item.status === "active" && !item.last_message && (
        <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink-2">
          <span className="text-muted">Founder&apos;s note: </span>
          {item.response_note}
        </p>
      )}
      {item.status === "declined" && <p className="text-sm text-muted">The founder decided not to connect this time.</p>}

      <div className="flex flex-wrap items-center gap-2">
        {item.status === "saved" && (
          <>
            <Button onClick={onRequest} disabled={busy}>
              {busy ? "Sending…" : "Request intro"}
            </Button>
            <Button variant="ghost" onClick={onUnsave} disabled={busy}>
              Remove
            </Button>
          </>
        )}
        {item.status === "requested" && (
          <>
            <span className="text-sm text-muted">Waiting on the founder.</span>
            <Button variant="ghost" onClick={onWithdraw} disabled={busy}>
              Withdraw request
            </Button>
          </>
        )}
        {item.room_id && (
          <ButtonLink href={`/dealroom/${item.room_id}`} variant={item.status === "active" ? "primary" : "secondary"}>
            <MessagesSquare className="h-4 w-4" />
            Open deal room
          </ButtonLink>
        )}
        {item.founder_email && item.status === "active" && (
          <a href={`mailto:${item.founder_email}`} className={buttonClass("secondary")}>
            <Mail className="h-4 w-4" />
            Email founder
          </a>
        )}
        {item.status === "closed" &&
          (item.investment_id ? (
            <ButtonLink href={`/investor/portfolio/${item.investment_id}`} variant="secondary">
              <Wallet className="h-4 w-4" />
              View in portfolio
            </ButtonLink>
          ) : (
            <ButtonLink href={recordHref} variant="secondary">
              <Wallet className="h-4 w-4" />
              Record your investment
            </ButtonLink>
          ))}
      </div>
    </Card>
  );
}
