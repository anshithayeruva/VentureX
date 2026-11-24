"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, ChevronDown, ExternalLink, Rocket, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice, Pagination } from "@/components/forms";
import { INSTRUMENT_NAME } from "@/components/funding";
import { AuthImage } from "@/components/profile";
import { VerifiedBadge, useInvestorCanContact } from "@/components/verification";
import { Button, ButtonLink, Toggle, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { normalizeThesis } from "@/lib/thesis";
import type { CriteriaOptions, DiscoverItem, DiscoverPage, DiscoverQuery, InvestmentThesis } from "@/types";

type Filters = {
  industry: string[];
  stage: string[];
  region: string[];
  country: string[];
  business_model: string[];
  min_raise: string;
  max_raise: string;
  ticket_min: string;
  ticket_max: string;
  min_monthly_revenue: string;
  min_customers: string;
  live_product: boolean;
  round_status: "" | "open" | "none";
  verified_only: boolean;
  matched_only: boolean;
};

const NO_FILTERS: Filters = {
  industry: [], stage: [], region: [], country: [], business_model: [], min_raise: "", max_raise: "", ticket_min: "",
  ticket_max: "", min_monthly_revenue: "", min_customers: "", live_product: false, round_status: "", verified_only: false,
  matched_only: false,
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

/** The investor's saved criteria as Discover filters (sectors, stages, geography). */
function fromThesis(t: InvestmentThesis): Filters {
  return { ...NO_FILTERS, industry: t.sectors.industries, stage: t.stages, region: t.geography.is_global ? [] : t.geography.regions, country: t.geography.is_global ? [] : t.geography.countries };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function DiscoverStartupsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Filters | null>(null);
  const [thesis, setThesis] = useState<InvestmentThesis | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<DiscoverQuery["sort"]>>("fit");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: DiscoverPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [options, setOptions] = useState<CriteriaOptions | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const canContact = useInvestorCanContact();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Start from the saved criteria (the thesis isn't changed unless the investor saves).
  useEffect(() => {
    api.getCriteriaOptions().then(setOptions).catch(() => setOptions(null));
    api
      .getInvestorPreferences()
      .then((p) => {
        const t = p?.thesis ? normalizeThesis(p.thesis) : null;
        setThesis(t);
        setFilters(t ? fromThesis(t) : NO_FILTERS);
      })
      .catch(() => setFilters(NO_FILTERS));
  }, []);

  const query: DiscoverQuery | null = useMemo(() => {
    if (!filters) return null;
    return {
      q: debouncedQ.trim() || undefined,
      industry: filters.industry, stage: filters.stage, region: filters.region, country: filters.country,
      business_model: filters.business_model, min_raise: num(filters.min_raise), max_raise: num(filters.max_raise),
      ticket_min: num(filters.ticket_min), ticket_max: num(filters.ticket_max),
      min_monthly_revenue: num(filters.min_monthly_revenue), min_customers: num(filters.min_customers),
      live_product: filters.live_product, round_status: filters.round_status || undefined,
      verified_only: filters.verified_only, matched_only: filters.matched_only, saved_only: savedOnly,
      sort, page, page_size: PAGE_SIZE,
    };
  }, [debouncedQ, filters, savedOnly, sort, page]);

  const key = JSON.stringify(query) + ":" + nonce;
  useEffect(() => {
    if (!query) return;
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
  const loading = !!query && result?.key !== key && !error;

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...(f ?? NO_FILTERS), ...patch }));
    setPage(1);
  };

  const flash = (text: string, ok = true) => {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), ok ? 4000 : 7000);
  };

  const patchItem = (id: number, p: Partial<DiscoverItem>) =>
    setResult((r) => (r ? { ...r, data: { ...r.data, items: r.data.items.map((i) => (i.id === id ? { ...i, ...p } : i)) } } : r));

  const toggleSave = async (item: DiscoverItem) => {
    setBusy(item.id);
    try {
      await api.setSaved(item.id, !item.saved);
      patchItem(item.id, { saved: !item.saved });
      if (savedOnly && item.saved) setNonce((n) => n + 1);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't update saved startups.", false);
    } finally {
      setBusy(null);
    }
  };

  const expressInterest = async (item: DiscoverItem) => {
    setBusy(item.id);
    try {
      const created = await api.expressInterest({ project_id: item.id, message: `Interested in learning more about ${item.title}.` });
      patchItem(item.id, { interest_status: "pending", interest_id: String(created.id) });
      flash(`Interest sent to ${item.title}. Track it in Deal Flow.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't send.", false);
    } finally {
      setBusy(null);
    }
  };

  const matchesThesis = !!thesis && !!filters && same(filters.industry, thesis.sectors.industries) && same(filters.stage, thesis.stages)
    && same(filters.region, thesis.geography.is_global ? [] : thesis.geography.regions) && same(filters.country, thesis.geography.is_global ? [] : thesis.geography.countries);
  const primaryChanged = !!filters && !matchesThesis;

  const saveAsCriteria = async () => {
    if (!thesis || !filters) return;
    try {
      const next: InvestmentThesis = {
        ...thesis,
        sectors: { ...thesis.sectors, industries: filters.industry },
        stages: filters.stage,
        geography: { ...thesis.geography, is_global: !filters.region.length && !filters.country.length ? thesis.geography.is_global : false, regions: filters.region, countries: filters.country },
      };
      await api.saveThesis(next);
      setThesis(next);
      flash("Saved as your investment criteria. Fit scores update shortly.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't save your criteria.", false);
    }
  };

  const facets = data?.facets;
  const moreCount = filters ? [filters.business_model.length, filters.min_raise, filters.max_raise, filters.ticket_min, filters.ticket_max, filters.min_monthly_revenue, filters.min_customers, filters.live_product, filters.round_status, filters.verified_only, filters.matched_only].filter(Boolean).length : 0;
  const anyFilter = !!filters && (filters.industry.length + filters.stage.length + filters.region.length + filters.country.length > 0 || moreCount > 0);

  return (
    <PortalLayout role="INVESTOR" activeItem="discover" title="Discover Startups">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[32px] leading-tight text-ink">Discover Startups</h1>
          <p className="mt-1 max-w-2xl text-muted">Published startups on VentureX, with what founders chose to share. Fit is calculated from your saved criteria.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={savedOnly ? "primary" : "secondary"} aria-pressed={savedOnly} onClick={() => { setSavedOnly((v) => !v); setPage(1); }}>
            <BookmarkCheck className="h-4 w-4" />
            Saved opportunities
          </Button>
          <ButtonLink href="/investor/preferences" variant="ghost">Edit criteria</ButtonLink>
        </div>
      </div>

      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" />
            <input type="search" aria-label="Search startups" placeholder="Search by company, problem, market…" value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }} className={cx(inputClass, "h-10 pl-9")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu label="Industry" values={filters?.industry ?? []} options={facets?.industries ?? []} onChange={(v) => update({ industry: v })} />
            <FilterMenu label="Stage" values={filters?.stage ?? []} options={options?.stages ?? []} onChange={(v) => update({ stage: v })} />
            <FilterMenu label="Region" values={filters?.region ?? []} options={options?.regions ?? []} onChange={(v) => update({ region: v })} />
            <FilterMenu label="Country" values={filters?.country ?? []} options={facets?.countries ?? []} onChange={(v) => update({ country: v })} />
            <Button variant={more || moreCount ? "secondary" : "ghost"} aria-expanded={more} onClick={() => setMore((m) => !m)}>
              <SlidersHorizontal className="h-4 w-4" />
              More filters{moreCount ? ` (${moreCount})` : ""}
            </Button>
            <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {more && filters && (
          <div className="mt-3 grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            <RangeField label="Funding requirement (₹)" lo={filters.min_raise} hi={filters.max_raise} onLo={(v) => update({ min_raise: v })} onHi={(v) => update({ max_raise: v })} />
            <RangeField label="Your ticket size (₹)" hint="Startups with an open round that accepts it" lo={filters.ticket_min} hi={filters.ticket_max} onLo={(v) => update({ ticket_min: v })} onHi={(v) => update({ ticket_max: v })} />
            <div className="space-y-2">
              <div className="text-sm font-medium text-ink">Traction</div>
              <input aria-label="Minimum monthly revenue" inputMode="numeric" placeholder="Min monthly revenue (₹)" className={inputClass} value={filters.min_monthly_revenue} onChange={(e) => update({ min_monthly_revenue: e.target.value })} />
              <input aria-label="Minimum customers" inputMode="numeric" placeholder="Min customers" className={inputClass} value={filters.min_customers} onChange={(e) => update({ min_customers: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink" htmlFor="df-round">Funding round</label>
              <select id="df-round" className={inputClass} value={filters.round_status} onChange={(e) => update({ round_status: e.target.value as Filters["round_status"] })}>
                <option value="">Any</option>
                <option value="open">Raising now (open round)</option>
                <option value="none">No open round</option>
              </select>
              <FilterMenu label="Business model" values={filters.business_model} options={facets?.business_models ?? []} onChange={(v) => update({ business_model: v })} />
            </div>
            <div className="divide-y divide-line sm:col-span-2 lg:col-span-4 lg:grid lg:grid-cols-4 lg:gap-4 lg:divide-y-0">
              <Toggle label="Fits my criteria" description="A fit score from your saved criteria" checked={filters.matched_only} onChange={(v) => update({ matched_only: v })} />
              <Toggle label="Verified startups only" description="Companies VentureX has verified" checked={filters.verified_only} onChange={(v) => update({ verified_only: v })} />
              <Toggle label="Product is live" description="As reported by founders" checked={filters.live_product} onChange={(v) => update({ live_product: v })} />
            </div>
          </div>
        )}

        {filters && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted" aria-live="polite">
              {data ? `${data.total} startup${data.total === 1 ? "" : "s"}` : " "}
              {loading && data ? " · updating…" : ""}
            </span>
            {thesis && matchesThesis && (filters.industry.length + filters.stage.length + filters.region.length + filters.country.length > 0) && <span className="inline-flex items-center gap-1 text-accent"><Sparkles className="h-3.5 w-3.5" />Using your saved criteria</span>}
            {thesis && primaryChanged && (
              <>
                <button type="button" className="text-accent hover:underline" onClick={() => { setFilters({ ...(filters ?? NO_FILTERS), ...fromThesis(thesis) }); setPage(1); }}>Back to my criteria</button>
                <button type="button" className="text-accent hover:underline" onClick={saveAsCriteria}>Save industry, stage and location as my criteria</button>
              </>
            )}
            {anyFilter && <button type="button" className="inline-flex items-center gap-1 text-muted hover:text-ink" onClick={() => { setFilters(NO_FILTERS); setPage(1); }}><X className="h-3.5 w-3.5" />Clear all filters</button>}
          </div>
        )}
      </div>

      {notice && <div className="mb-4"><Notice {...notice} /></div>}
      {data && !data.criteria_set && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-ink-2">Set your investment criteria to see how each startup fits.</span>
          <ButtonLink href="/investor/preferences" variant="secondary">Set criteria</ButtonLink>
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !data ? (
        <ResultSkeleton />
      ) : data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
          {savedOnly ? <Bookmark className="mx-auto h-6 w-6 text-faint" /> : <Rocket className="mx-auto h-6 w-6 text-faint" />}
          <h2 className="mt-3 text-lg text-ink">{savedOnly ? "No saved opportunities" : anyFilter || debouncedQ ? "No startups match" : "No published startups yet"}</h2>
          <p className="mt-1 text-sm text-muted">
            {savedOnly ? "Save startups with the bookmark to come back to them." : anyFilter || debouncedQ ? "Try fewer filters or a different search." : "Startups appear here once founders publish them."}
          </p>
          {(anyFilter || debouncedQ || savedOnly) && (
            <Button variant="secondary" className="mt-4" onClick={() => { setFilters(NO_FILTERS); setQ(""); setSavedOnly(false); setPage(1); }}>Clear search and filters</Button>
          )}
        </div>
      ) : (
        <>
          <ol className={cx("divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface", loading && "opacity-60")}>
            {data.items.map((item) => (
              <StartupRow key={item.id} item={item} criteriaSet={data.criteria_set} canContact={canContact !== false}
                busy={busy === item.id} onSave={() => toggleSave(item)} onInterest={() => expressInterest(item)} />
            ))}
          </ol>
          <div className="mt-5"><Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} /></div>
        </>
      )}
    </PortalLayout>
  );
}

function RangeField({ label, hint, lo, hi, onLo, onHi }: { label: string; hint?: string; lo: string; hi: string; onLo: (v: string) => void; onHi: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={`${label} minimum`} inputMode="numeric" placeholder="Min" className={inputClass} value={lo} onChange={(e) => onLo(e.target.value)} />
        <input aria-label={`${label} maximum`} inputMode="numeric" placeholder="Max" className={inputClass} value={hi} onChange={(e) => onHi(e.target.value)} />
      </div>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** A compact multi-select: a button that opens a checklist. */
function FilterMenu({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const all = [...options, ...values.filter((v) => !options.includes(v))];
  const toggle = useCallback((o: string) => onChange(values.includes(o) ? values.filter((x) => x !== o) : [...values, o]), [values, onChange]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
          values.length ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-subtle")}>
        {label}{values.length ? ` · ${values.length}` : ""}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="listbox" aria-label={label} aria-multiselectable className="absolute left-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-elevated">
          {all.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted">No options yet</p>
          ) : (
            all.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-subtle">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={values.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))
          )}
          {values.length > 0 && (
            <button type="button" className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-subtle" onClick={() => onChange([])}>Clear {label.toLowerCase()}</button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true" aria-label="Loading startups">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex gap-4 px-5 py-5">
          <div className="h-12 w-12 animate-pulse rounded-lg bg-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-subtle" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-subtle" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-subtle" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function StartupRow({ item, criteriaSet, canContact, busy, onSave, onInterest }: {
  item: DiscoverItem; criteriaSet: boolean; canContact: boolean; busy: boolean; onSave: () => void; onInterest: () => void;
}) {
  const location = [item.city, item.country].filter(Boolean).join(", ");
  const met = item.reasons.filter((r) => r.score == null || r.score >= 75);
  const round = item.open_round;
  return (
    <li className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 gap-4">
        <AuthImage path={item.has_logo ? `/projects/${item.id}/logo` : null} name={item.title} size={48} rounded="lg" />
        <div className="min-w-0 space-y-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/investor/projects/${item.id}`} className="text-base font-medium text-ink hover:underline">{item.title}</Link>
              {item.company_verified && <VerifiedBadge kind="company" />}
            </div>
            {item.tagline && <p className="text-sm text-ink-2">{item.tagline}</p>}
            <p className="mt-0.5 text-xs text-muted">{[item.industry, item.stage, item.business_model, location].filter(Boolean).join(" · ")}</p>
          </div>
          {(item.problem || item.solution) && (
            <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
              {item.problem && <p className="line-clamp-2 text-ink-2"><span className="text-xs uppercase tracking-wide text-faint">Problem </span>{item.problem}</p>}
              {item.solution && <p className="line-clamp-2 text-ink-2"><span className="text-xs uppercase tracking-wide text-faint">Solution </span>{item.solution}</p>}
            </div>
          )}
          {item.match_score != null && met.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Why it fits your criteria">
              {met.slice(0, 4).map((r) => (
                <span key={r.category} title={r.explanation} className="rounded-md bg-positive-soft px-2 py-0.5 text-xs text-positive">{r.category.replace(" Focus", "").replace(" Alignment", "").replace("Target ", "")}</span>
              ))}
            </div>
          )}
          {item.partners && item.partners.length > 0 && (
            <p className="text-xs text-warning">{item.partners.map((p) => p.name).join(", ")} from your firm {item.partners.length === 1 ? "is" : "are"} already talking to them.</p>
          )}
          {(item.website || item.demo_url) && (
            <div className="flex gap-3 text-xs">
              {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Website<ExternalLink className="h-3 w-3" /></a>}
              {item.demo_url && <a href={item.demo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Demo<ExternalLink className="h-3 w-3" /></a>}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 border-line lg:border-l lg:pl-5">
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted">Raising</span>
            <span className="figure text-lg text-ink">{formatMoney(item.funding_required)}</span>
          </div>
          {round ? (
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>{round.name} · {INSTRUMENT_NAME[round.instrument]}</span>
                {round.committed_pct != null && <span>{round.committed_pct}% committed</span>}
              </div>
              {round.committed_pct != null && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full bg-positive" style={{ width: `${Math.min(100, Number(round.committed_pct))}%` }} /></div>
              )}
            </div>
          ) : (
            <p className="text-xs text-faint">No open funding round</p>
          )}
          {item.match_score != null ? (
            <div className="flex items-baseline justify-between gap-2"><span className="text-muted">Fit with your criteria</span><span className="font-medium text-positive">{Math.round(item.match_score)}%</span></div>
          ) : criteriaSet ? (
            <p className="text-xs text-faint">Outside your criteria</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={`/investor/projects/${item.id}`} variant="secondary">View details</ButtonLink>
          <button type="button" onClick={onSave} disabled={busy} aria-pressed={item.saved} aria-label={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
            className="rounded-md border border-line p-2 text-muted hover:bg-subtle hover:text-ink disabled:opacity-60">
            {item.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
          </button>
          {item.room_id ? (
            <ButtonLink href={`/dealroom/${item.room_id}`} variant="ghost">Deal room</ButtonLink>
          ) : item.interest_status === "pending" && item.interest_initiated_by === "founder" ? (
            <ButtonLink href="/investor/deal-flow" variant="ghost">Founder asked to connect</ButtonLink>
          ) : item.interest_status === "pending" ? (
            <span className="text-xs text-warning">Interest sent</span>
          ) : item.interest_status === "accepted" ? (
            <span className="text-xs text-positive">Connected</span>
          ) : item.interest_status === "declined" ? (
            <span className="text-xs text-muted">{item.interest_initiated_by === "founder" ? "You passed" : "Founder declined"}</span>
          ) : !canContact ? (
            <ButtonLink href="/investor/verification" variant="ghost">Verify to request</ButtonLink>
          ) : (
            <Button onClick={onInterest} disabled={busy}>{busy ? "Sending…" : "Express interest"}</Button>
          )}
        </div>
      </div>
    </li>
  );
}
