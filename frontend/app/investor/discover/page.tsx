"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, MessagesSquare, Rocket, Search, SlidersHorizontal, X } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ChipGroup, ErrorState, Notice, Pagination, ReasonLine } from "@/components/forms";
import { Button, ButtonLink, Card, EmptyState, Field, LoadingRows, PageHeader, Tag, Toggle, buttonClass, cx, inputClass } from "@/components/ui";
import { VerifiedBadge, useInvestorCanContact } from "@/components/verification";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { CriteriaOptions, DiscoverItem, DiscoverPage, DiscoverQuery } from "@/types";

type Filters = Required<Pick<DiscoverQuery, "industry" | "stage" | "business_model" | "country" | "region">> & {
  min_raise: string;
  max_raise: string;
  min_monthly_revenue: string;
  min_customers: string;
  live_product: boolean;
  matched_only: boolean;
  saved_only: boolean;
  verified_only: boolean;
};

const NO_FILTERS: Filters = {
  industry: [],
  stage: [],
  business_model: [],
  country: [],
  region: [],
  min_raise: "",
  max_raise: "",
  min_monthly_revenue: "",
  min_customers: "",
  live_product: false,
  matched_only: false,
  saved_only: false,
  verified_only: false,
};

const SORTS: { value: NonNullable<DiscoverQuery["sort"]>; label: string }[] = [
  { value: "fit", label: "Best fit" },
  { value: "newest", label: "Newest" },
  { value: "raise_asc", label: "Raise: low to high" },
  { value: "raise_desc", label: "Raise: high to low" },
];
const PAGE_SIZE = 12;

const num = (v: string) => {
  const n = parseFloat(v.replace(/[,\s₹$]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export default function DiscoverPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<NonNullable<DiscoverQuery["sort"]>>("fit");
  const [page, setPage] = useState(1);
  // Results and errors are tagged with the query they answer; "loading" is simply
  // "the latest answer isn't for the current query yet".
  const [result, setResult] = useState<{ key: string; data: DiscoverPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [options, setOptions] = useState<CriteriaOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api.getCriteriaOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  const query: DiscoverQuery = useMemo(
    () => ({
      q: debouncedQ.trim() || undefined,
      industry: filters.industry,
      stage: filters.stage,
      business_model: filters.business_model,
      country: filters.country,
      region: filters.region,
      min_raise: num(filters.min_raise),
      max_raise: num(filters.max_raise),
      min_monthly_revenue: num(filters.min_monthly_revenue),
      min_customers: num(filters.min_customers),
      live_product: filters.live_product,
      matched_only: filters.matched_only,
      saved_only: filters.saved_only,
      verified_only: filters.verified_only,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedQ, filters, sort, page]
  );

  const key = JSON.stringify(query) + ":" + nonce;
  useEffect(() => {
    let current = true;
    api
      .discover(query)
      .then((data) => current && setResult({ key, data }))
      .catch((err) => current && setFailure({ key, message: err instanceof Error ? err.message : "Couldn't load startups." }));
    return () => {
      current = false;
    };
  }, [query, key]);

  const data = result?.data ?? null;
  const error = failure?.key === key ? failure.message : null;
  const loading = result?.key !== key && !error;
  const reload = () => setNonce((n) => n + 1);

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const activeCount =
    filters.industry.length +
    filters.stage.length +
    filters.business_model.length +
    filters.country.length +
    filters.region.length +
    [filters.min_raise, filters.max_raise, filters.min_monthly_revenue, filters.min_customers].filter(Boolean).length +
    [filters.live_product, filters.matched_only, filters.saved_only, filters.verified_only].filter(Boolean).length;

  const patchItem = (id: number, patch: Partial<DiscoverItem>) =>
    setResult((r) => (r ? { ...r, data: { ...r.data, items: r.data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } } : r));

  const flash = (text: string, ok = true) => {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), ok ? 4000 : 7000);
  };

  const toggleSave = async (item: DiscoverItem) => {
    setBusy(item.id);
    try {
      await api.setSaved(item.id, !item.saved);
      patchItem(item.id, { saved: !item.saved });
      if (filters.saved_only && item.saved) reload();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't update saved startups.", false);
    } finally {
      setBusy(null);
    }
  };

  const requestIntro = async (item: DiscoverItem) => {
    setBusy(item.id);
    try {
      const created = await api.expressInterest({
        project_id: item.id,
        project_title: item.title,
        project_industry: item.industry,
        message: `Interested in learning more about ${item.title} and discussing the ${item.stage} round.`,
      });
      patchItem(item.id, { interest_status: "pending", interest_id: String(created.id) });
      flash(`Intro requested for ${item.title}. It's in your Deal Flow.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't send the intro request.", false);
    } finally {
      setBusy(null);
    }
  };

  const facets = data?.facets;
  const canContact = useInvestorCanContact();

  const filterPanel = (
    <div className="space-y-6">
      <div className="divide-y divide-line">
        <Toggle label="Matches only" description="Startups that fit your criteria." checked={filters.matched_only} onChange={(v) => update({ matched_only: v })} />
        <Toggle label="Saved only" description="Startups you've bookmarked." checked={filters.saved_only} onChange={(v) => update({ saved_only: v })} />
        <Toggle label="Verified startups only" description="Companies VentureX has verified." checked={filters.verified_only} onChange={(v) => update({ verified_only: v })} />
      </div>
      {facets && facets.industries.length > 0 && (
        <Field label="Industry">
          <ChipGroup label="Industry" options={facets.industries} selected={filters.industry} onChange={(v) => update({ industry: v })} />
        </Field>
      )}
      {options && (
        <Field label="Stage">
          <ChipGroup label="Stage" options={options.stages} selected={filters.stage} onChange={(v) => update({ stage: v })} />
        </Field>
      )}
      <Field label="Raising (₹)">
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Minimum raise" inputMode="numeric" placeholder="Min" className={inputClass} value={filters.min_raise} onChange={(e) => update({ min_raise: e.target.value })} />
          <input aria-label="Maximum raise" inputMode="numeric" placeholder="Max" className={inputClass} value={filters.max_raise} onChange={(e) => update({ max_raise: e.target.value })} />
        </div>
      </Field>
      {options && (
        <Field label="Region">
          <ChipGroup label="Region" options={options.regions} selected={filters.region} onChange={(v) => update({ region: v })} />
        </Field>
      )}
      {facets && facets.countries.length > 0 && (
        <Field label="Country">
          <ChipGroup label="Country" options={facets.countries} selected={filters.country} onChange={(v) => update({ country: v })} />
        </Field>
      )}
      {facets && facets.business_models.length > 0 && (
        <Field label="Business model">
          <ChipGroup label="Business model" options={facets.business_models} selected={filters.business_model} onChange={(v) => update({ business_model: v })} />
        </Field>
      )}
      <Field label="Traction" hint="As reported by founders.">
        <div className="space-y-2">
          <input aria-label="Minimum monthly revenue" inputMode="numeric" placeholder="Min monthly revenue (₹)" className={inputClass} value={filters.min_monthly_revenue} onChange={(e) => update({ min_monthly_revenue: e.target.value })} />
          <input aria-label="Minimum customers" inputMode="numeric" placeholder="Min customers" className={inputClass} value={filters.min_customers} onChange={(e) => update({ min_customers: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={filters.live_product} onChange={(e) => update({ live_product: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
            Product is live
          </label>
        </div>
      </Field>
      {activeCount > 0 && (
        <Button variant="ghost" onClick={() => update(NO_FILTERS)}>
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <PortalLayout role="INVESTOR" activeItem="discover" title="Discover">
      <PageHeader
        title="Discover"
        description="Every published startup, ranked by fit with your criteria. Search, filter and save the ones worth a closer look."
        actions={
          <ButtonLink href="/investor/preferences" variant="secondary">
            Edit criteria
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
          <input
            type="search"
            aria-label="Search startups"
            placeholder="Search by name, problem, market…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className={cx(inputClass, "pl-9")}
          />
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(1);
            }}
            className={cx(inputClass, "sm:w-48")}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
        </div>
      </div>

      {notice && (
        <div className="mb-5">
          <Notice {...notice} />
        </div>
      )}

      {data && !data.criteria_set && (
        <Card className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Set your criteria to see how startups fit</div>
            <p className="text-sm text-muted">Fit scores and reasons appear once you choose what you invest in.</p>
          </div>
          <ButtonLink href="/investor/preferences" className="shrink-0">
            Set criteria
          </ButtonLink>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={cx("lg:block", showFilters ? "block" : "hidden")}>
          <Card>{filterPanel}</Card>
        </aside>

        <div className="min-w-0 space-y-5">
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading && !data ? (
            <LoadingRows />
          ) : !data || data.items.length === 0 ? (
            activeCount || debouncedQ ? (
              <EmptyState
                compact
                title="No startups match"
                description="Try fewer filters or a different search."
                action={
                  <Button variant="secondary" onClick={() => { update(NO_FILTERS); setQ(""); }}>
                    Clear search and filters
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Rocket} title="No published startups yet" description="Startups appear here once founders publish them." />
            )
          ) : (
            <>
              <p className="text-sm text-muted" aria-live="polite">
                {data.total} startup{data.total === 1 ? "" : "s"}
                {loading && " · updating…"}
              </p>
              <div className={cx("grid gap-4 xl:grid-cols-2", loading && "opacity-60")}>
                {data.items.map((item) => (
                  <StartupCard
                    key={item.id}
                    item={item}
                    criteriaSet={data.criteria_set}
                    canContact={canContact !== false}
                    busy={busy === item.id}
                    onSave={() => toggleSave(item)}
                    onRequest={() => requestIntro(item)}
                  />
                ))}
              </div>
              <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

function StartupCard({
  item,
  criteriaSet,
  canContact,
  busy,
  onSave,
  onRequest,
}: {
  item: DiscoverItem;
  criteriaSet: boolean;
  canContact: boolean;
  busy: boolean;
  onSave: () => void;
  onRequest: () => void;
}) {
  const location = [item.city, item.country].filter(Boolean).join(", ");
  const facts = [
    location,
    item.monthly_revenue != null ? `${formatMoney(item.monthly_revenue)}/mo revenue` : null,
    item.customer_count != null ? `${item.customer_count.toLocaleString()} customers` : null,
  ].filter(Boolean);
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/investor/projects/${item.id}`} className="text-sm font-medium text-ink hover:underline">
            {item.title}
          </Link>
          <div className="text-sm text-muted">{[item.stage, item.industry, item.business_model].filter(Boolean).join(" · ")}</div>
          {item.company_verified && <VerifiedBadge kind="company" className="mt-1.5" />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.match_score != null ? (
            <Tag tone={item.match_score >= 85 ? "positive" : "accent"}>{Math.round(item.match_score)}% fit</Tag>
          ) : criteriaSet ? (
            <Tag>Outside criteria</Tag>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            aria-pressed={item.saved}
            aria-label={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
            className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink disabled:opacity-60"
          >
            {item.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {(item.tagline || item.description) && <p className="mt-3 line-clamp-2 text-sm text-ink-2">{item.tagline || item.description}</p>}
      {facts.length > 0 && <p className="mt-2 text-xs text-muted">{facts.join(" · ")}</p>}
      {item.reasons.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-accent hover:underline">How it matches</summary>
          <ul className="mt-2 space-y-1">
            {item.reasons.map((r) => (
              <ReasonLine key={r.category} reason={r} />
            ))}
          </ul>
        </details>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="text-sm">
          <span className="text-muted">Raising </span>
          <span className="font-medium tabular-nums text-ink">{formatMoney(item.funding_required)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/investor/projects/${item.id}`} className={buttonClass("ghost")}>
            Details
          </Link>
          {item.room_id ? (
            <ButtonLink href={`/dealroom/${item.room_id}`} variant="secondary">
              <MessagesSquare className="h-4 w-4" />
              Deal room
            </ButtonLink>
          ) : item.interest_status === "pending" && item.interest_initiated_by === "founder" ? (
            <ButtonLink href="/investor/deal-flow" variant="secondary">
              Founder asked to connect
            </ButtonLink>
          ) : item.interest_status === "pending" ? (
            <Tag tone="warning">Intro requested</Tag>
          ) : item.interest_status === "declined" ? (
            <Tag>{item.interest_initiated_by === "founder" ? "You passed" : "Founder declined"}</Tag>
          ) : item.interest_status === "expired" ? (
            <Tag>No response</Tag>
          ) : item.interest_status === "accepted" ? (
            <Tag tone="positive">Connected</Tag>
          ) : !canContact ? (
            <ButtonLink href="/investor/verification" variant="secondary">
              Verify to request
            </ButtonLink>
          ) : (
            <Button onClick={onRequest} disabled={busy}>
              {busy ? "Sending…" : "Request intro"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
