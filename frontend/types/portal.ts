/* Investor portal types: criteria thesis, discovery, deal flow, portfolio & finances. */
import type { MatchReason } from "./index";

export type Requirement = "required" | "preferred" | "not_relevant";
export type Priority = "high" | "medium" | "low" | "ignore";
/** Money travels as a decimal string ("125000.00") so it never passes through floating point. */
export type MoneyString = string;

export interface InvestmentThesis {
  sectors: {
    industries: string[];
    sub_industries: string[];
    sectors: string[];
    technologies: string[];
    excluded_industries: string[];
    business_models: string[];
  };
  stages: string[];
  check_size: {
    min_check: MoneyString | null;
    max_check: MoneyString | null;
    preferred_check: MoneyString | null;
    total_allocation: MoneyString | null;
    currency: "INR";
  };
  geography: {
    is_global: boolean;
    regions: string[];
    countries: string[];
    cities: string[];
    excluded_countries: string[];
  };
  traction: {
    revenue: Requirement;
    min_monthly_revenue: MoneyString | null;
    customers: Requirement;
    min_customers: number | null;
    live_product: Requirement;
  };
  structure: {
    instruments: string[];
    role: "lead" | "co_invest" | "either";
    min_ownership_pct: string | null;
    max_ownership_pct: string | null;
    board_seat: Requirement;
  };
  team: {
    technical_founder: Requirement;
    repeat_founder: Requirement;
    domain_expertise: Requirement;
    full_time_team: Requirement;
    min_team_size: number | null;
  };
  additional: {
    horizon_years: number | null;
    risk_tolerance: "low" | "moderate" | "high" | null;
    product_maturity: "any" | "prototype" | "launched" | "scaling" | null;
    differentiation: Requirement;
    ip_protection: Requirement;
    scalability: Requirement;
    exit_paths: string[];
    notes: string;
  };
  priorities: {
    industry: Priority;
    stage: Priority;
    check_size: Priority;
    geography: Priority;
    business_model: Priority;
    traction: Priority;
    team: Priority;
  };
}

export interface CriteriaOptions {
  stages: string[];
  regions: string[];
  countries: string[];
  instruments: string[];
}

export interface DiscoverItem {
  id: number;
  title: string;
  tagline?: string | null;
  description: string;
  industry: string;
  stage: string;
  funding_required: number;
  business_model: string;
  target_market: string;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  monthly_revenue?: number | null;
  customer_count?: number | null;
  product_status?: string | null;
  team_size?: number | null;
  technical_founder?: boolean | null;
  repeat_founder?: boolean | null;
  domain_expertise?: boolean | null;
  full_time_team?: boolean | null;
  ip_protected?: boolean | null;
  created_at?: string | null;
  match_score?: number | null;
  reasons: MatchReason[];
  saved: boolean;
  interest_id?: string | null;
  interest_status?: "pending" | "accepted" | "declined" | null;
  room_id?: string | null;
  deal_stage?: string | null;
}

export interface DiscoverPage {
  items: DiscoverItem[];
  total: number;
  page: number;
  page_size: number;
  facets: { industries: string[]; business_models: string[]; countries: string[] };
  /** False until the investor sets criteria; then no fit scores exist yet. */
  criteria_set: boolean;
}

export interface DiscoverQuery {
  q?: string;
  industry?: string[];
  stage?: string[];
  business_model?: string[];
  country?: string[];
  region?: string[];
  min_raise?: number;
  max_raise?: number;
  min_monthly_revenue?: number;
  min_customers?: number;
  live_product?: boolean;
  matched_only?: boolean;
  saved_only?: boolean;
  sort?: "fit" | "newest" | "raise_asc" | "raise_desc";
  page?: number;
  page_size?: number;
}

export type DealFlowStatus = "saved" | "requested" | "active" | "closed" | "declined" | "passed";

export interface DealFlowItem {
  project_id: number;
  title: string;
  industry?: string | null;
  stage?: string | null;
  funding_required?: number | null;
  tagline?: string | null;
  status: DealFlowStatus;
  saved: boolean;
  interest_id?: string | null;
  interest_status?: "pending" | "accepted" | "declined" | null;
  response_note?: string | null;
  founder_email?: string | null;
  requested_at?: string | null;
  room_id?: string | null;
  deal_stage?: string | null;
  founder_name?: string | null;
  founder_company?: string | null;
  last_message?: string | null;
  messages_count?: number | null;
  last_activity?: string | null;
  investment_id?: number | null;
}

export interface DealFlow {
  items: DealFlowItem[];
  counts: Partial<Record<DealFlowStatus, number>>;
}

export type InvestmentStatus = "active" | "exited" | "written_off";
export type Instrument = "equity" | "safe" | "convertible_note" | "debt" | "revenue_based" | "other";
export type TransactionType =
  | "investment"
  | "follow_on"
  | "distribution"
  | "dividend"
  | "exit_proceeds"
  | "interest"
  | "fee";
export type ValuationSource = "self_reported" | "company_report" | "funding_round" | "third_party";

export interface Holding {
  id: number;
  project_id?: number | null;
  company_name: string;
  industry: string;
  stage: string;
  instrument: Instrument;
  investment_date: string;
  ownership_pct?: string | null;
  status: InvestmentStatus;
  notes: string;
  cost_basis: MoneyString;
  cash_returned: MoneyString;
  current_value: MoneyString;
  valuation_basis: "valuation" | "cost" | "exited" | "written_off";
  valuation_date?: string | null;
  valuation_source?: ValuationSource | null;
  unrealized_gain: MoneyString;
  net_gain: MoneyString;
  multiple?: string | null;
}

export interface PortfolioTotals {
  total_invested: MoneyString;
  current_value: MoneyString;
  cash_returned: MoneyString;
  income: MoneyString;
  realized_gain: MoneyString;
  unrealized_gain: MoneyString;
  net_gain: MoneyString;
  roi_pct?: string | null;
  multiple?: string | null;
  active_count: number;
  exited_count: number;
  written_off_count: number;
  held_at_cost_count: number;
  pending_transactions: number;
}

export interface SeriesPoint {
  date: string;
  invested: MoneyString;
  value: MoneyString;
  returned: MoneyString;
}

export interface PortfolioSummary {
  currency: "INR";
  totals: PortfolioTotals;
  holdings: Holding[];
  value_over_time: SeriesPoint[];
  allocation_by_industry: { label: string; cost_basis: MoneyString; share_pct: string }[];
}

export interface Transaction {
  id: number;
  investment_id: number;
  company_name?: string | null;
  txn_date: string;
  type: TransactionType;
  amount: MoneyString;
  status: "completed" | "pending";
  description: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface Valuation {
  id: number;
  investment_id: number;
  valuation_date: string;
  value: MoneyString;
  source: ValuationSource;
  note: string;
}

export interface InvestmentDetail {
  holding: Holding;
  transactions: Transaction[];
  valuations: Valuation[];
}

export interface InvestmentInput {
  company_name?: string;
  project_id?: number | null;
  industry?: string;
  stage?: string;
  instrument?: Instrument;
  investment_date: string;
  amount: MoneyString;
  ownership_pct?: string | null;
  notes?: string;
}

export interface InvestmentPatch {
  company_name?: string;
  industry?: string;
  stage?: string;
  instrument?: Instrument;
  investment_date?: string;
  ownership_pct?: string | null;
  status?: InvestmentStatus;
  notes?: string;
}

export interface TransactionInput {
  txn_date: string;
  type: TransactionType;
  amount: MoneyString;
  status?: "completed" | "pending";
  description?: string;
}

export interface ValuationInput {
  valuation_date: string;
  value: MoneyString;
  source?: ValuationSource;
  note?: string;
}

export interface PortfolioImportResult {
  valid_rows: number;
  errors: { row: number; message: string }[];
  imported: number;
}
