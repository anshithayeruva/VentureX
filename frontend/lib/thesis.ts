import type { InvestmentThesis, Priority, Requirement } from "@/types";
import { formatCompact } from "@/lib/money";

export const EMPTY_THESIS: InvestmentThesis = {
  sectors: { industries: [], sub_industries: [], sectors: [], technologies: [], excluded_industries: [], business_models: [] },
  stages: [],
  check_size: { min_check: null, max_check: null, preferred_check: null, total_allocation: null, currency: "INR" },
  geography: { is_global: false, regions: [], countries: [], cities: [], excluded_countries: [] },
  traction: { revenue: "not_relevant", min_monthly_revenue: null, customers: "not_relevant", min_customers: null, live_product: "not_relevant" },
  structure: { instruments: [], role: "either", min_ownership_pct: null, max_ownership_pct: null, board_seat: "not_relevant" },
  team: { technical_founder: "not_relevant", repeat_founder: "not_relevant", domain_expertise: "not_relevant", full_time_team: "not_relevant", min_team_size: null },
  additional: {
    horizon_years: null,
    risk_tolerance: null,
    product_maturity: null,
    differentiation: "not_relevant",
    ip_protection: "not_relevant",
    scalability: "not_relevant",
    exit_paths: [],
    notes: "",
  },
  priorities: { industry: "high", stage: "high", check_size: "medium", geography: "medium", business_model: "low", traction: "medium" },
};

/** Fill any missing section so older saved theses still render every control. */
export function normalizeThesis(t?: Partial<InvestmentThesis> | null): InvestmentThesis {
  const src = (t || {}) as Partial<InvestmentThesis>;
  return {
    sectors: { ...EMPTY_THESIS.sectors, ...src.sectors },
    stages: src.stages ?? [],
    check_size: { ...EMPTY_THESIS.check_size, ...src.check_size },
    geography: { ...EMPTY_THESIS.geography, ...src.geography },
    traction: { ...EMPTY_THESIS.traction, ...src.traction },
    structure: { ...EMPTY_THESIS.structure, ...src.structure },
    team: { ...EMPTY_THESIS.team, ...src.team },
    additional: { ...EMPTY_THESIS.additional, ...src.additional },
    priorities: { ...EMPTY_THESIS.priorities, ...src.priorities },
  };
}

export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  required: "Required",
  preferred: "Preferred",
  not_relevant: "Not relevant",
};

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low", ignore: "Ignore" };

export const INSTRUMENT_LABEL: Record<string, string> = {
  equity: "Equity",
  safe: "SAFE",
  convertible_note: "Convertible note",
  debt: "Debt",
  revenue_based: "Revenue-based financing",
  other: "Other",
};

function list(items: string[], joiner = "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${joiner} ${items[items.length - 1]}`;
}

/** The thesis in a few plain sentences, built only from what the investor filled in. */
export function summarizeThesis(t: InvestmentThesis): string[] {
  const out: string[] = [];
  const c = t.check_size;

  const what: string[] = [];
  if (t.sectors.industries.length) what.push(list(t.sectors.industries));
  const where = t.geography.is_global
    ? "globally"
    : t.geography.regions.length || t.geography.countries.length || t.geography.cities.length
      ? `in ${list([...t.geography.cities, ...t.geography.countries, ...t.geography.regions], "or")}`
      : "";
  const stages = t.stages.length ? `at ${list(t.stages, "or")}` : "";
  if (what.length || stages || where) {
    out.push(`Invests in ${what.length ? what.join(" ") + " startups" : "startups"}${stages ? " " + stages : ""}${where ? " " + where : ""}.`);
  }

  if (c.min_check || c.max_check) {
    let s = `Writes checks of ${c.min_check ? formatCompact(c.min_check) : "any size"}${c.max_check ? ` to ${formatCompact(c.max_check)}` : " and up"}`;
    if (c.preferred_check) s += `, typically ${formatCompact(c.preferred_check)}`;
    s += c.total_allocation ? `, from ${formatCompact(c.total_allocation)} set aside for startups.` : ".";
    out.push(s);
  } else if (c.total_allocation) {
    out.push(`Has ${formatCompact(c.total_allocation)} set aside for startups.`);
  }

  if (t.sectors.business_models.length) out.push(`Prefers ${list(t.sectors.business_models, "or")} business models.`);
  if (t.sectors.technologies.length) out.push(`Looks for ${list(t.sectors.technologies, "or")}.`);

  const avoid = [...t.sectors.excluded_industries, ...t.geography.excluded_countries];
  if (avoid.length) out.push(`Avoids ${list(avoid, "and")}.`);

  const needs: string[] = [];
  const tr = t.traction;
  if (tr.revenue !== "not_relevant")
    needs.push(`${tr.revenue === "required" ? "requires" : "prefers"} revenue${tr.min_monthly_revenue ? ` of ${formatCompact(tr.min_monthly_revenue)}+/month` : ""}`);
  if (tr.customers !== "not_relevant")
    needs.push(`${tr.customers === "required" ? "requires" : "prefers"} ${tr.min_customers ? `${tr.min_customers.toLocaleString()}+ ` : ""}paying customers`);
  if (tr.live_product !== "not_relevant") needs.push(`${tr.live_product === "required" ? "requires" : "prefers"} a live product`);
  if (needs.length) out.push(`${needs.join("; ").replace(/^./, (ch) => ch.toUpperCase())}.`);

  const st = t.structure;
  const how: string[] = [];
  if (st.instruments.length) how.push(`via ${list(st.instruments, "or")}`);
  if (st.role !== "either") how.push(st.role === "lead" ? "as lead investor" : "as a co-investor");
  if (st.min_ownership_pct || st.max_ownership_pct)
    how.push(`targeting ${st.min_ownership_pct ?? "0"}–${st.max_ownership_pct ?? "100"}% ownership`);
  if (how.length) out.push(`Invests ${how.join(", ")}.`);

  const a = t.additional;
  const extra: string[] = [];
  if (a.horizon_years) extra.push(`${a.horizon_years}-year horizon`);
  if (a.risk_tolerance) extra.push(`${a.risk_tolerance} risk tolerance`);
  if (a.exit_paths.length) extra.push(`expects exits via ${list(a.exit_paths, "or")}`);
  if (extra.length) out.push(`${extra.join(", ").replace(/^./, (ch) => ch.toUpperCase())}.`);

  return out;
}
