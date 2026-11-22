"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { BUSINESS_MODELS, INDUSTRIES } from "@/components/ProjectForm";
import { ChipGroup, Choice, ErrorState, MoneyInput, TagInput } from "@/components/forms";
import { Card, Field, LoadingRows, PageHeader, Toggle, buttonClass, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cleanMoneyInput } from "@/lib/money";
import { EMPTY_THESIS, PRIORITY_LABEL, REQUIREMENT_LABEL, normalizeThesis, summarizeThesis } from "@/lib/thesis";
import type { CriteriaOptions, InvestmentThesis, Priority, Requirement } from "@/types";

const TECHNOLOGIES = [
  "Generative AI & LLMs",
  "Machine learning",
  "Computer vision",
  "Robotics & automation",
  "Blockchain",
  "Quantum computing",
  "Biotech platforms",
  "IoT & edge devices",
  "AR / VR",
  "Clean energy tech",
];
const EXIT_PATHS = ["Acquisition", "IPO", "Secondary sale", "Buyback", "Dividends / cash flow"];
const REQUIREMENTS: { value: Requirement; label: string }[] = (["required", "preferred", "not_relevant"] as Requirement[]).map(
  (v) => ({ value: v, label: REQUIREMENT_LABEL[v] })
);
const PRIORITIES: { value: Priority; label: string }[] = (["high", "medium", "low", "ignore"] as Priority[]).map((v) => ({
  value: v,
  label: PRIORITY_LABEL[v],
}));

type Section = { id: string; label: string };
const SECTIONS: Section[] = [
  { id: "focus", label: "Industry & focus" },
  { id: "stages", label: "Stages" },
  { id: "amounts", label: "Investment amounts" },
  { id: "geography", label: "Geography" },
  { id: "traction", label: "Business & traction" },
  { id: "structure", label: "Investment structure" },
  { id: "team", label: "Founder & team" },
  { id: "additional", label: "Additional" },
  { id: "priorities", label: "Match priorities" },
];

export default function InvestorCriteriaPage() {
  const [thesis, setThesis] = useState<InvestmentThesis | null>(null);
  const [options, setOptions] = useState<CriteriaOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api.getInvestorPreferences(), api.getCriteriaOptions()])
      .then(([prefs, opts]) => {
        if (!prefs) throw new Error("Couldn't load your criteria. Nothing has been changed.");
        setThesis(normalizeThesis(prefs.thesis));
        setOptions(opts);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load your criteria."));
  }, []);

  useEffect(load, [load]);

  const summary = useMemo(() => (thesis ? summarizeThesis(thesis) : []), [thesis]);

  /** Update one section of the thesis. */
  function set<K extends keyof InvestmentThesis>(key: K, patch: Partial<InvestmentThesis[K]> | InvestmentThesis[K]) {
    setSaved(false);
    setThesis((prev) => {
      if (!prev) return prev;
      const current = prev[key];
      const next = Array.isArray(current) ? patch : { ...(current as object), ...(patch as object) };
      return { ...prev, [key]: next } as InvestmentThesis;
    });
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thesis) return;
    setError(null);
    // Money fields stay strings end to end; normalise "1,500,000" -> "1500000".
    const money = (label: string, v: string | null): string | null => {
      if (v == null || v.trim() === "") return null;
      const clean = cleanMoneyInput(v);
      if (clean == null) throw new Error(`${label}: enter an amount like 250000 or 250000.50.`);
      return clean;
    };
    let payload: InvestmentThesis;
    try {
      payload = {
        ...thesis,
        check_size: {
          ...thesis.check_size,
          min_check: money("Minimum check", thesis.check_size.min_check),
          max_check: money("Maximum check", thesis.check_size.max_check),
          preferred_check: money("Preferred check", thesis.check_size.preferred_check),
          total_allocation: money("Total capital allocated", thesis.check_size.total_allocation),
        },
        traction: { ...thesis.traction, min_monthly_revenue: money("Minimum monthly revenue", thesis.traction.min_monthly_revenue) },
      };
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setSaving(true);
    try {
      const res = await api.saveThesis(payload);
      setThesis(normalizeThesis(res.thesis));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your criteria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout role="INVESTOR" activeItem="preferences" title="Criteria">
      <PageHeader
        title="Investment criteria"
        description="Your thesis. It ranks startups in Discover and decides which founders see you as a fit."
      />
      {loadError ? (
        <ErrorState
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            load();
          }}
        />
      ) : !thesis || !options ? (
        <LoadingRows />
      ) : (
        <form onSubmit={save} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <nav aria-label="Criteria sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-muted hover:text-ink">
                  {s.label}
                </a>
              ))}
            </nav>

            {/* A. Industry & focus */}
            <Block id="focus" title="Industry & focus">
              <Field label="Industries">
                <ChipGroup
                  label="Industries"
                  options={INDUSTRIES}
                  selected={thesis.sectors.industries}
                  onChange={(v) => set("sectors", { industries: v })}
                />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Sub-industries" htmlFor="c-sub" hint="Press Enter after each, e.g. Payments, Insurtech.">
                  <TagInput id="c-sub" values={thesis.sectors.sub_industries} onChange={(v) => set("sectors", { sub_industries: v })} />
                </Field>
                <Field label="Sectors" htmlFor="c-sectors" hint="e.g. Healthcare providers, Logistics.">
                  <TagInput id="c-sectors" values={thesis.sectors.sectors} onChange={(v) => set("sectors", { sectors: v })} />
                </Field>
              </div>
              <Field label="Emerging technologies">
                <ChipGroup
                  label="Emerging technologies"
                  options={TECHNOLOGIES}
                  selected={thesis.sectors.technologies}
                  onChange={(v) => set("sectors", { technologies: v })}
                />
              </Field>
              <Field label="Business models">
                <ChipGroup
                  label="Business models"
                  options={BUSINESS_MODELS}
                  selected={thesis.sectors.business_models}
                  onChange={(v) => set("sectors", { business_models: v })}
                />
              </Field>
              <Field label="Excluded industries" htmlFor="c-excl" hint="Startups in these industries are never matched.">
                <TagInput
                  id="c-excl"
                  values={thesis.sectors.excluded_industries}
                  suggestions={INDUSTRIES.filter((i) => !thesis.sectors.industries.includes(i))}
                  onChange={(v) => set("sectors", { excluded_industries: v })}
                />
              </Field>
            </Block>

            {/* B. Stages */}
            <Block id="stages" title="Stages" description="Pick every stage you invest in.">
              <ChipGroup label="Stages" options={options.stages} selected={thesis.stages} onChange={(v) => set("stages", v)} />
            </Block>

            {/* C. Amounts */}
            <Block
              id="amounts"
              title="Investment amounts"
              description="A check is what you put into one company. Total capital is everything you've set aside for startups."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Minimum check" htmlFor="c-min">
                  <MoneyInput id="c-min" value={thesis.check_size.min_check} onChange={(v) => set("check_size", { min_check: v })} />
                </Field>
                <Field label="Preferred check" htmlFor="c-pref">
                  <MoneyInput id="c-pref" value={thesis.check_size.preferred_check} onChange={(v) => set("check_size", { preferred_check: v })} />
                </Field>
                <Field label="Maximum check" htmlFor="c-max">
                  <MoneyInput id="c-max" value={thesis.check_size.max_check} onChange={(v) => set("check_size", { max_check: v })} />
                </Field>
              </div>
              <div className="max-w-xs">
                <Field label="Total capital allocated" htmlFor="c-total" hint="Optional. Across all startups, not per company.">
                  <MoneyInput id="c-total" value={thesis.check_size.total_allocation} onChange={(v) => set("check_size", { total_allocation: v })} />
                </Field>
              </div>
            </Block>

            {/* D. Geography */}
            <Block id="geography" title="Geography">
              <Toggle
                label="Invest globally"
                description="Location doesn't matter. Regions and countries below are ignored for matching."
                checked={thesis.geography.is_global}
                onChange={(v) => set("geography", { is_global: v })}
              />
              <div className={cx("space-y-5", thesis.geography.is_global && "opacity-50")}>
                <Field label="Regions">
                  <ChipGroup label="Regions" options={options.regions} selected={thesis.geography.regions} onChange={(v) => set("geography", { regions: v })} />
                </Field>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Countries" htmlFor="c-countries">
                    <TagInput
                      id="c-countries"
                      values={thesis.geography.countries}
                      suggestions={options.countries}
                      placeholder="Start typing a country"
                      onChange={(v) => set("geography", { countries: v })}
                    />
                  </Field>
                  <Field label="Cities" htmlFor="c-cities">
                    <TagInput id="c-cities" values={thesis.geography.cities} placeholder="e.g. Berlin" onChange={(v) => set("geography", { cities: v })} />
                  </Field>
                </div>
              </div>
              <Field label="Excluded countries" htmlFor="c-excl-c" hint="Applies even when investing globally.">
                <TagInput
                  id="c-excl-c"
                  values={thesis.geography.excluded_countries}
                  suggestions={options.countries}
                  onChange={(v) => set("geography", { excluded_countries: v })}
                />
              </Field>
            </Block>

            {/* E. Traction */}
            <Block
              id="traction"
              title="Business & traction"
              description="Required rules out startups that report less. Startups that haven't reported a figure are scored lower, not excluded."
            >
              <RequirementRow label="Revenue" value={thesis.traction.revenue} onChange={(v) => set("traction", { revenue: v })}>
                {thesis.traction.revenue !== "not_relevant" && (
                  <div className="w-44">
                    <MoneyInput
                      id="c-rev"
                      placeholder="Min / month"
                      value={thesis.traction.min_monthly_revenue}
                      onChange={(v) => set("traction", { min_monthly_revenue: v })}
                    />
                  </div>
                )}
              </RequirementRow>
              <RequirementRow label="Paying customers" value={thesis.traction.customers} onChange={(v) => set("traction", { customers: v })}>
                {thesis.traction.customers !== "not_relevant" && (
                  <input
                    aria-label="Minimum customers"
                    type="number"
                    min={0}
                    placeholder="Minimum"
                    className={cx(inputClass, "w-32")}
                    value={thesis.traction.min_customers ?? ""}
                    onChange={(e) => set("traction", { min_customers: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                )}
              </RequirementRow>
              <RequirementRow label="Live product" value={thesis.traction.live_product} onChange={(v) => set("traction", { live_product: v })} />
            </Block>

            {/* F. Structure */}
            <Block id="structure" title="Investment structure">
              <Field label="Instruments">
                <ChipGroup label="Instruments" options={options.instruments} selected={thesis.structure.instruments} onChange={(v) => set("structure", { instruments: v })} />
              </Field>
              <Field label="Your role">
                <Choice
                  label="Your role"
                  value={thesis.structure.role}
                  onChange={(v) => set("structure", { role: v })}
                  options={[
                    { value: "lead", label: "Lead" },
                    { value: "co_invest", label: "Co-invest" },
                    { value: "either", label: "Either" },
                  ]}
                />
              </Field>
              <div className="grid max-w-md gap-5 sm:grid-cols-2">
                <Field label="Min ownership %" htmlFor="c-own-min">
                  <PctInput id="c-own-min" value={thesis.structure.min_ownership_pct} onChange={(v) => set("structure", { min_ownership_pct: v })} />
                </Field>
                <Field label="Max ownership %" htmlFor="c-own-max">
                  <PctInput id="c-own-max" value={thesis.structure.max_ownership_pct} onChange={(v) => set("structure", { max_ownership_pct: v })} />
                </Field>
              </div>
              <RequirementRow label="Board seat" value={thesis.structure.board_seat} onChange={(v) => set("structure", { board_seat: v })} />
            </Block>

            {/* G. Team */}
            <Block id="team" title="Founder & team" note>
              <RequirementRow label="Technical founder" value={thesis.team.technical_founder} onChange={(v) => set("team", { technical_founder: v })} />
              <RequirementRow label="Repeat founder" value={thesis.team.repeat_founder} onChange={(v) => set("team", { repeat_founder: v })} />
              <RequirementRow label="Domain expertise" value={thesis.team.domain_expertise} onChange={(v) => set("team", { domain_expertise: v })} />
              <RequirementRow label="Full-time team" value={thesis.team.full_time_team} onChange={(v) => set("team", { full_time_team: v })} />
              <div className="max-w-[10rem]">
                <Field label="Minimum team size" htmlFor="c-team">
                  <input
                    id="c-team"
                    type="number"
                    min={1}
                    className={inputClass}
                    value={thesis.team.min_team_size ?? ""}
                    onChange={(e) => set("team", { min_team_size: e.target.value === "" ? null : Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </Field>
              </div>
            </Block>

            {/* H. Additional */}
            <Block id="additional" title="Additional preferences" note>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Horizon (years)" htmlFor="c-horizon">
                  <input
                    id="c-horizon"
                    type="number"
                    min={1}
                    max={30}
                    className={inputClass}
                    value={thesis.additional.horizon_years ?? ""}
                    onChange={(e) =>
                      set("additional", { horizon_years: e.target.value === "" ? null : Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)) })
                    }
                  />
                </Field>
                <Field label="Risk tolerance" htmlFor="c-risk">
                  <select
                    id="c-risk"
                    className={inputClass}
                    value={thesis.additional.risk_tolerance ?? ""}
                    onChange={(e) => set("additional", { risk_tolerance: (e.target.value || null) as InvestmentThesis["additional"]["risk_tolerance"] })}
                  >
                    <option value="">Not set</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <Field label="Product maturity" htmlFor="c-maturity">
                  <select
                    id="c-maturity"
                    className={inputClass}
                    value={thesis.additional.product_maturity ?? ""}
                    onChange={(e) => set("additional", { product_maturity: (e.target.value || null) as InvestmentThesis["additional"]["product_maturity"] })}
                  >
                    <option value="">Not set</option>
                    <option value="any">Any</option>
                    <option value="prototype">Prototype or later</option>
                    <option value="launched">Launched</option>
                    <option value="scaling">Scaling</option>
                  </select>
                </Field>
              </div>
              <RequirementRow label="Clear differentiation" value={thesis.additional.differentiation} onChange={(v) => set("additional", { differentiation: v })} />
              <RequirementRow label="IP protection" value={thesis.additional.ip_protection} onChange={(v) => set("additional", { ip_protection: v })} />
              <RequirementRow label="Scalability" value={thesis.additional.scalability} onChange={(v) => set("additional", { scalability: v })} />
              <Field label="Exit expectations">
                <ChipGroup label="Exit expectations" options={EXIT_PATHS} selected={thesis.additional.exit_paths} onChange={(v) => set("additional", { exit_paths: v })} />
              </Field>
              <Field label="Notes" htmlFor="c-notes" hint="Anything else about how you invest. Only you see this.">
                <textarea
                  id="c-notes"
                  rows={3}
                  maxLength={2000}
                  className={inputClass}
                  value={thesis.additional.notes}
                  onChange={(e) => set("additional", { notes: e.target.value })}
                />
              </Field>
            </Block>

            {/* I. Priorities */}
            <Block
              id="priorities"
              title="Match priorities"
              description="How much each criterion counts toward a startup's fit score. Ignore leaves it out."
            >
              {(
                [
                  ["industry", "Industry"],
                  ["stage", "Stage"],
                  ["check_size", "Check size"],
                  ["geography", "Geography"],
                  ["traction", "Traction"],
                  ["business_model", "Business model"],
                ] as [keyof InvestmentThesis["priorities"], string][]
              ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-ink">{label}</span>
                  <Choice label={`${label} priority`} value={thesis.priorities[key]} onChange={(v) => set("priorities", { [key]: v })} options={PRIORITIES} />
                </div>
              ))}
            </Block>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-1 py-4 backdrop-blur">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-positive" role="status">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved. Your matches are updated.
                </span>
              )}
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={() => {
                  setThesis({ ...EMPTY_THESIS });
                  setSaved(false);
                }}
              >
                Clear all
              </button>
              <button type="submit" disabled={saving} className={buttonClass("primary")}>
                {saving ? "Saving…" : "Save criteria"}
              </button>
            </div>
          </div>

          {/* J. Thesis summary */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="space-y-3">
              <h2 className="text-base font-semibold text-ink">Your thesis</h2>
              {summary.length ? (
                <div className="space-y-2 text-sm leading-relaxed text-ink-2">
                  {summary.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Pick industries, stages and a check size to see your thesis here.</p>
              )}
              <p className="border-t border-line pt-3 text-xs text-muted">Updates as you edit. Save to apply it to your matches.</p>
            </Card>
          </aside>
        </form>
      )}
    </PortalLayout>
  );
}

function Block({
  id,
  title,
  description,
  note,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  note?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="scroll-mt-6 space-y-5">
      <div id={id} className="scroll-mt-6">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        {note && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Saved to your thesis and summary. Not used in fit scores yet, because startups don&apos;t report these details.
          </p>
        )}
      </div>
      {children}
    </Card>
  );
}

function RequirementRow({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: Requirement;
  onChange: (v: Requirement) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <Choice label={label} value={value} onChange={onChange} options={REQUIREMENTS} />
      </div>
    </div>
  );
}

function PctInput({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        className={cx(inputClass, "pr-7")}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, "");
          onChange(v === "" ? null : v);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-2 text-sm text-faint">%</span>
    </div>
  );
}
