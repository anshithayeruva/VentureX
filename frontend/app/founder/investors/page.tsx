"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Users, X } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Pagination, ReasonLine } from "@/components/forms";
import { ProjectGate, ProjectPicker, ROLE_LABEL, RelationshipTag, chequeRange } from "@/components/outreach";
import { Avatar, Button, ButtonLink, Card, EmptyState, Field, LoadingRows, PageHeader, Tag, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { DirectoryInvestor, DirectoryQuery, InvestorDirectory } from "@/types";

type Filters = { stage: string; sector: string; min_check: string; max_check: string; location: string; role: "" | "lead" | "co_invest" };
const NO_FILTERS: Filters = { stage: "", sector: "", min_check: "", max_check: "", location: "", role: "" };
const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Pre-IPO"];
const PAGE_SIZE = 12;

const num = (v: string) => {
  const n = parseFloat(v.replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function FindInvestorsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const projectParam = params.get("project");
  const projectId = projectParam ? Number(projectParam) : undefined;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<"fit" | "name">("fit");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: InvestorDirectory } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query: DirectoryQuery = useMemo(
    () => ({
      project_id: projectId,
      q: debouncedQ.trim() || undefined,
      stage: filters.stage || undefined,
      sector: filters.sector || undefined,
      min_check: num(filters.min_check),
      max_check: num(filters.max_check),
      location: filters.location.trim() || undefined,
      role: filters.role || undefined,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
    [projectId, debouncedQ, filters, sort, page]
  );
  const key = JSON.stringify(query) + ":" + nonce;

  useEffect(() => {
    let current = true;
    api
      .getInvestorDirectory(query)
      .then((data) => current && setResult({ key, data }))
      .catch((err) => current && setFailure({ key, message: err instanceof Error ? err.message : "Couldn't load investors." }));
    return () => {
      current = false;
    };
  }, [query, key]);

  const data = result?.data ?? null;
  const error = failure?.key === key ? failure.message : null;
  const loading = result?.key !== key && !error;
  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const activeCount = Object.values(filters).filter(Boolean).length;
  const chosen = data?.project ?? null;

  const pickProject = (id: number) => {
    setPage(1);
    router.replace(`/founder/investors?project=${id}`);
  };

  const filterBar = (
    <Card className={cx("mb-5 lg:block", showFilters ? "block" : "hidden")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="Stage">
          <select aria-label="Stage" value={filters.stage} onChange={(e) => update({ stage: e.target.value })} className={inputClass}>
            <option value="">Any stage</option>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Sector">
          <select aria-label="Sector" value={filters.sector} onChange={(e) => update({ sector: e.target.value })} className={inputClass}>
            <option value="">Any sector</option>
            {(data?.facets.sectors ?? []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Min cheque (₹)">
          <input aria-label="Minimum cheque" inputMode="numeric" placeholder="e.g. 25,00,000" className={inputClass} value={filters.min_check} onChange={(e) => update({ min_check: e.target.value })} />
        </Field>
        <Field label="Max cheque (₹)">
          <input aria-label="Maximum cheque" inputMode="numeric" placeholder="e.g. 2,00,00,000" className={inputClass} value={filters.max_check} onChange={(e) => update({ max_check: e.target.value })} />
        </Field>
        <Field label="City or country">
          <input aria-label="City or country" placeholder="e.g. India, Bengaluru" className={inputClass} value={filters.location} onChange={(e) => update({ location: e.target.value })} />
        </Field>
        <Field label="Role">
          <select aria-label="Leads or co-invests" value={filters.role} onChange={(e) => update({ role: e.target.value as Filters["role"] })} className={inputClass}>
            <option value="">Leads or co-invests</option>
            <option value="lead">Leads rounds</option>
            <option value="co_invest">Co-invests</option>
          </select>
        </Field>
      </div>
      {activeCount > 0 && (
        <Button variant="ghost" className="mt-3" onClick={() => update(NO_FILTERS)}>
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </Card>
  );

  return (
    <PortalLayout role="FOUNDER" activeItem="investors" title="Find investors">
      <PageHeader
        title="Find investors"
        description="Investors on VentureX, ranked by how well your project fits their own criteria. Open a profile to see what they back and request an intro."
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ProjectPicker projects={data?.projects ?? []} value={chosen?.id} onChange={pickProject} />
        <div className="flex min-w-0 flex-1 gap-2 lg:max-w-xl">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
            <input
              type="search"
              aria-label="Search investors"
              placeholder="Search name, firm, sector…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className={cx(inputClass, "pl-9")}
            />
          </div>
          <div className="w-28 shrink-0 sm:w-36">
            <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value as "fit" | "name"); setPage(1); }} className={inputClass}>
            <option value="fit">Best fit</option>
            <option value="name">Name</option>
          </select>
          </div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount ? `(${activeCount})` : ""}
          </Button>
        </div>
      </div>

      {filterBar}
      {data && <ProjectGate project={chosen} minReadiness={data.min_readiness} />}

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : loading && !data ? (
        <LoadingRows />
      ) : !data || data.items.length === 0 ? (
        activeCount || debouncedQ ? (
          <EmptyState
            compact
            title="No investors match"
            description="Try fewer filters or a different search."
            action={<Button variant="secondary" onClick={() => { update(NO_FILTERS); setQ(""); }}>Clear search and filters</Button>}
          />
        ) : (
          <EmptyState icon={Users} title="No investors listed yet" description="Investors appear here once they join VentureX and choose to be found by founders." />
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {data.total} investor{data.total === 1 ? "" : "s"}
            {chosen && sort === "fit" ? ` · best fit for ${chosen.title} first` : ""}
            {loading && " · updating…"}
          </p>
          <div className={cx("grid grid-cols-1 gap-4 xl:grid-cols-2", loading && "opacity-60")}>
            {data.items.map((inv) => (
              <InvestorCard key={inv.investor_id} inv={inv} projectId={chosen?.id} />
            ))}
          </div>
          <div className="mt-5">
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          </div>
        </>
      )}
    </PortalLayout>
  );
}

function InvestorCard({ inv, projectId }: { inv: DirectoryInvestor; projectId?: number }) {
  const href = `/founder/investors/${encodeURIComponent(inv.investor_id)}${projectId ? `?project=${projectId}` : ""}`;
  const cheque = chequeRange(inv.min_check, inv.max_check);
  const where = inv.is_global ? "Global" : [...inv.countries, ...inv.regions].slice(0, 3).join(", ");
  const facts = [inv.stages.join(", "), cheque && `${cheque} cheques`, ROLE_LABEL[inv.role], where].filter(Boolean);
  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={inv.name} />
          <div className="min-w-0">
            <Link href={href} className="text-sm font-medium text-ink hover:underline">
              {inv.name}
            </Link>
            <div className="truncate text-sm text-muted">{[inv.firm, inv.title, inv.location].filter(Boolean).join(" · ") || "Independent investor"}</div>
          </div>
        </div>
        <div className="shrink-0">
          {inv.match_score != null ? (
            <Tag tone={inv.match_score >= 85 ? "positive" : "accent"}>{Math.round(inv.match_score)}% fit</Tag>
          ) : inv.excluded_reason ? (
            <Tag tone="danger">Outside their criteria</Tag>
          ) : !inv.criteria_set ? (
            <Tag>No criteria yet</Tag>
          ) : (
            <Tag>Weak fit</Tag>
          )}
        </div>
      </div>
      {inv.sectors.length > 0 && <p className="mt-3 text-sm text-ink-2">Backs {inv.sectors.join(", ")}</p>}
      {facts.length > 0 && <p className="mt-1 text-xs text-muted">{facts.join(" · ")}</p>}
      {inv.excluded_reason ? (
        <p className="mt-3 text-sm text-muted">{inv.excluded_reason}</p>
      ) : (
        inv.reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {inv.reasons.map((r) => (
              <ReasonLine key={r.category} reason={{ ...r, explanation: `${r.category}: ${r.explanation}` }} />
            ))}
          </ul>
        )
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <RelationshipTag rel={inv.relationship} />
        <ButtonLink href={href} variant="secondary" className="ml-auto">
          View profile
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function FindInvestorsPage() {
  return (
    <Suspense fallback={null}>
      <FindInvestorsContent />
    </Suspense>
  );
}
