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
  interest_status?: "pending" | "accepted" | "declined" | "expired" | null;
  interest_initiated_by?: "investor" | "founder" | null;
  company_verified?: boolean;
  partners?: PartnerActivity[];
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
  verified_only?: boolean;
  sort?: "fit" | "newest" | "raise_asc" | "raise_desc";
  page?: number;
  page_size?: number;
}

export type DealFlowStatus = "saved" | "inbound" | "requested" | "active" | "closed" | "declined" | "passed" | "expired";

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
  interest_status?: "pending" | "accepted" | "declined" | "expired" | null;
  initiated_by?: "investor" | "founder" | null;
  pass_reason?: PassReason | null;
  /** A founder's note when they asked to connect. */
  message?: string | null;
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


/* ---------- founder outreach ---------- */

export type PassReason = "too_early" | "outside_focus" | "market_size" | "team" | "traction" | "timing" | "other";

export const PASS_REASON_LABEL: Record<PassReason, string> = {
  too_early: "Too early for us",
  outside_focus: "Outside our focus",
  market_size: "Market size",
  team: "Team",
  traction: "Not enough traction yet",
  timing: "Not investing right now",
  other: "Other",
};

export interface PortfolioEntry {
  company: string;
  stage?: string | null;
  year?: number | null;
  url?: string | null;
}

export interface FitReason {
  category: string;
  explanation: string;
  weight?: number;
  score?: number;
}

export interface OutreachProject {
  id: number;
  title: string;
  is_published: boolean;
  readiness_score: number | null;
  stage?: string | null;
  industry?: string | null;
  tagline?: string | null;
  funding_required?: number | null;
  /** One-liner, amount raising and traction, for the request draft. */
  summary: string;
  company_verified?: boolean;
}

export interface OutreachRelationship {
  interest_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  initiated_by: "investor" | "founder";
  pass_reason?: PassReason | null;
  pass_reason_label?: string | null;
  response_note?: string | null;
  room_id?: string | null;
  requested_at?: string | null;
}

export interface DirectoryInvestor {
  investor_id: string;
  name: string;
  firm: string;
  title: string;
  location: string;
  stages: string[];
  sectors: string[];
  min_check: number | null;
  max_check: number | null;
  role: "lead" | "co_invest" | "either";
  is_global: boolean;
  regions: string[];
  countries: string[];
  criteria_set: boolean;
  verified: boolean;
  match_score: number | null;
  reasons: FitReason[];
  excluded_reason: string | null;
  relationship: OutreachRelationship | null;
}

export interface InvestorDirectory {
  items: DirectoryInvestor[];
  total: number;
  page: number;
  page_size: number;
  project: OutreachProject | null;
  projects: OutreachProject[];
  facets: { sectors: string[]; stages: string[] };
  min_readiness: number;
}

export interface DirectoryQuery {
  project_id?: number;
  q?: string;
  stage?: string;
  sector?: string;
  min_check?: number;
  max_check?: number;
  location?: string;
  role?: "lead" | "co_invest";
  verified_only?: boolean;
  sort?: "fit" | "name";
  page?: number;
  page_size?: number;
}

export interface IntroBlocker {
  code: string;
  message: string;
}

export interface PublicInvestorProfile {
  investor_id: string;
  name: string;
  firm: string;
  title: string;
  location: string;
  bio: string;
  value_add: string;
  portfolio: PortfolioEntry[];
  thesis: Partial<InvestmentThesis>;
  criteria_set: boolean;
  email: string | null;
  verified: boolean;
  connected: boolean;
  stats: { enough_data: boolean; resolved_requests: number; reply_rate: number | null; median_reply_days: number | null };
  partners?: { investor_id: string; name: string; title: string }[];
  match_score: number | null;
  reasons: FitReason[];
  excluded_reason: string | null;
  relationship: OutreachRelationship | null;
  eligibility: { can_request: boolean; blockers: IntroBlocker[]; sent_today: number; daily_limit: number; company_verified?: boolean };
  project: OutreachProject | null;
  projects: OutreachProject[];
  min_readiness: number;
}


/* ---------- verification ---------- */

export type InvestorVerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type CompanyVerificationStatus = "unverified" | "code_sent" | "pending" | "verified" | "rejected";
export type RegistrationType = "gstin" | "cin" | "llpin" | "udyam";

export interface InvestorVerification {
  status: InvestorVerificationStatus;
  review_note?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  linkedin_url: string;
  website: string;
  past_investments: PortfolioEntry[];
  required: boolean;
}

export interface CompanyVerification {
  project_id: number;
  status: CompanyVerificationStatus;
  method?: "domain_email" | "registration" | null;
  email?: string | null;
  domain?: string | null;
  website_domain?: string | null;
  registration_type?: RegistrationType | null;
  registration_number?: string | null;
  review_note?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  code_expires_at?: string | null;
  registration_types: Record<RegistrationType, string>;
}

export interface AdminInvestorRow {
  user_id: string;
  name?: string | null;
  firm?: string | null;
  title?: string | null;
  location?: string | null;
  email: string;
  linkedin_url: string;
  website: string;
  portfolio: PortfolioEntry[];
  status: InvestorVerificationStatus;
  review_note?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

export interface AdminCompanyRow {
  project_id: number;
  title: string;
  website?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  founder_name?: string | null;
  founder_email?: string | null;
  status: CompanyVerificationStatus;
  method?: "domain_email" | "registration" | null;
  email?: string | null;
  domain?: string | null;
  registration_type?: RegistrationType | null;
  registration_number?: string | null;
  evidence_note?: string | null;
  review_note?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  verified_at?: string | null;
}

export type ReviewDecision = "approve" | "reject" | "revoke";


/* ---------- investor updates ---------- */

export interface UpdateMetrics {
  monthly_revenue?: string | number | null;
  customers?: number | null;
  cash_in_bank?: string | number | null;
  monthly_burn?: string | number | null;
  headcount?: number | null;
  post_money_valuation?: string | number | null;
  custom?: { label: string; value: string }[];
  /** Worked out from cash and burn. */
  runway_months?: number | null;
}

export type UpdateAudience = "investors" | "investors_and_connected";

export interface UpdateInput {
  period_type: "month" | "quarter";
  period_end: string;
  period_label?: string | null;
  metrics: UpdateMetrics;
  highlights: string;
  challenges: string;
  asks: string[];
  audience: UpdateAudience;
}

export interface UpdateRecipient {
  investor_id: string;
  name: string;
  firm: string;
  reason: "investor" | "connected";
  read_at?: string | null;
}

export interface UpdateResponse {
  id: number;
  ask_index?: number | null;
  message: string;
  created_at: string;
  investor_id?: string;
  name?: string;
  firm?: string;
}

export interface CompanyUpdate {
  id: number;
  project_id: number;
  period_type: "month" | "quarter";
  period_label: string;
  period_end: string;
  status: "draft" | "sent";
  metrics: UpdateMetrics;
  highlights: string;
  challenges: string;
  asks: string[];
  audience: UpdateAudience;
  recipients_count: number;
  sent_at?: string | null;
  created_at?: string;
  read_count?: number;
  responses_count?: number;
}

export interface FounderUpdateDetail extends CompanyUpdate {
  project: { id: number; title: string };
  recipients: UpdateRecipient[];
  responses: UpdateResponse[];
  previous: { period_label: string; metrics: UpdateMetrics } | null;
}

export interface ProjectUpdates {
  project: { id: number; title: string };
  updates: CompanyUpdate[];
  last_sent_at: string | null;
  next_due: string | null;
  audience_counts: Record<UpdateAudience, number>;
}

export interface InvestorUpdateItem extends CompanyUpdate {
  project_title: string;
  project_industry?: string | null;
  read_at?: string | null;
  my_responses: UpdateResponse[];
  previous: { period_label: string; metrics: UpdateMetrics } | null;
  holding: { investment_id: number; ownership_pct: number | null; suggested_value: number | null } | null;
}

export interface InvestorUpdatesPage {
  items: InvestorUpdateItem[];
  total: number;
  page: number;
  page_size: number;
  unread: number;
}


/* ---------- teams ---------- */

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface ProjectTeamMember {
  user_id: string;
  role: "owner" | "cofounder";
  name: string;
  email?: string | null;
  created_at?: string;
}

export interface ProjectTeam {
  project: { id: number; title: string };
  members: ProjectTeamMember[];
  invitations: PendingInvite[];
  can_manage: boolean;
  you: string;
}

export interface FirmMember {
  user_id: string;
  role: "admin" | "partner";
  name: string;
  email?: string | null;
  title?: string | null;
  verification_status?: string;
  created_at?: string;
}

export interface MyFirm {
  firm: { id: number; name: string; website: string; created_at?: string } | null;
  members: FirmMember[];
  invitations: PendingInvite[];
  is_admin: boolean;
  you?: string;
}

export interface FirmPipelineRow {
  project_id: number;
  title: string;
  industry?: string | null;
  stage?: string | null;
  member_id: string;
  member_name: string;
  intro_status: "pending" | "accepted" | "declined" | "expired";
  initiated_by: "investor" | "founder";
  updated_at: string;
  deal_stage?: string | null;
  invested: boolean;
}

export interface PartnerActivity {
  name: string;
  status: "pending" | "accepted";
  initiated_by: "investor" | "founder";
}

export interface Invitation {
  id: string;
  kind: "project" | "firm";
  role: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  target_name: string;
  invited_by?: string | null;
  expires_at: string;
  email: string;
  expired: boolean;
  for_you?: boolean;
}
