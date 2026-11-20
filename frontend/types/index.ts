export type Role = "FOUNDER" | "INVESTOR" | "ADMIN";

export interface User {
  id: number;
  email: string;
  role: Role;
  created_at: string;
}

export interface FounderProfile {
  id: number;
  user_id: number;
  full_name?: string;
  company_name?: string;
  bio?: string;
  location?: string;
  linkedin_url?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface InvestorPreference {
  id?: number;
  investor_id?: number;
  preferred_industries: string[];
  preferred_stages: string[];
  min_investment: number;
  max_investment: number;
  preferred_business_models: string[];
  geography: string;
  tech_preferences: string[];
}

export interface InvestorProfile {
  id: number;
  user_id: number;
  full_name?: string;
  firm_name?: string;
  title?: string;
  bio?: string;
  location?: string;
  linkedin_url?: string;
  website?: string;
  investment_thesis?: string;
  preference?: InvestorPreference;
}

export interface Project {
  id: number;
  founder_id: number;
  title: string;
  tagline?: string;
  description: string;
  problem: string;
  solution: string;
  industry: string;
  stage: string;
  funding_required: number;
  business_model: string;
  target_market: string;
  website?: string;
  pitch_deck_url?: string;
  github_url?: string;
  demo_url?: string;
  is_published?: boolean;
  readiness_score?: number;
  ai_readiness_breakdown?: {
    problem_solution_fit?: number;
    market_sizing?: number;
    business_model_clarity?: number;
    traction_feasibility?: number;
    product_technology?: number;
  };
  ai_feedback_summary?: string;
  strengths?: string[];
  recommendations?: string[];
  created_at: string;
  updated_at?: string;
}

export interface ProjectCreateInput {
  title: string;
  tagline?: string;
  description: string;
  problem: string;
  solution: string;
  industry: string;
  stage: string;
  funding_required: number;
  business_model: string;
  target_market: string;
  website?: string;
  pitch_deck_url?: string;
  github_url?: string;
  demo_url?: string;
  is_published?: boolean;
}

/** A founder-uploaded project material (pitch deck, business plan, ...). */
export interface ProjectDocument {
  id: number;
  project_id: number;
  category: string;
  original_name: string;
  url: string;
  content_type: string;
  size_bytes: number;
  page_count?: number | null;
  text_chars: number;
  extraction_note?: string | null;
  created_at: string;
}

export type Severity = "high" | "medium" | "low";

export interface ReadinessDimension {
  key: string;
  name: string;
  score: number | null;
  desc: string;
  description?: string;
}

/** Private readiness report: the latest analysis of a project. */
export interface ReadinessReport {
  project_id: number;
  title: string;
  readiness_score: number;
  model_version: string;
  status_label: string;
  dimensions: ReadinessDimension[];
  strengths: string[];
  recommendations: string[];
  is_confidential: boolean;
  engine?: "claude" | "rules" | null;
  is_ai_generated: boolean;
  summary?: string | null;
  gaps: { area: string; issue: string; severity: Severity }[];
  suggestions: { title: string; detail: string; priority: Severity }[];
  industry_insights: string[];
  inputs?: {
    documents: { id: number; name: string; category: string; pages?: number | null; text_chars: number }[];
    github?: { url?: string; ok?: boolean; error?: string | null; full_name?: string | null } | null;
    demo_url?: string | null;
    website?: string | null;
  } | null;
  analyzed_at?: string | null;
  analysis_id?: number | null;
}

export interface AnalysisHistoryItem {
  id: number;
  engine: "claude" | "rules";
  model?: string | null;
  overall_score: number;
  status_label: string;
  created_at: string;
}

export interface MatchReason {
  category: string;
  explanation: string;
  weight: number;
}

export interface MatchItem {
  id: string;
  project_id: number;
  project_title: string;
  investor_id: number;
  investor_name: string;
  investor_firm?: string;
  match_score: number;
  reasons: MatchReason[];
  status: string;
}

export interface DealRoomDetails {
  unlocked: boolean;
  unlocked_at?: string;
  founder_name?: string;
  founder_email?: string;
  founder_phone?: string;
  founder_linkedin?: string;
  direct_messaging_channel?: string;
  meeting_scheduler_url?: string;
  data_room_url?: string;
  pitch_deck_url?: string;
  financial_model_url?: string;
  cap_table_verified?: boolean;
}

export interface ProjectInterest {
  id: string | number;
  project_id: string | number;
  project_title?: string;
  project_industry?: string;
  investor_id?: string | number;
  investor_name?: string;
  investor_firm?: string;
  investor_email?: string;
  founder_id?: string | number;
  founder_name?: string;
  founder_email?: string;
  status: "pending" | "accepted" | "declined";
  message?: string;
  response_note?: string;
  deal_room?: DealRoomDetails;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string | number;
  user_id?: string | number;
  target_role?: "FOUNDER" | "INVESTOR";
  title: string;
  desc: string;
  time?: string;
  badge: string;
  badge_variant: "primary" | "secondary" | "success" | "warning" | "error";
  read: boolean;
  link?: string;
  created_at?: string;
}

export interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size_kb?: number;
}

export interface DealMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_role: "FOUNDER" | "INVESTOR" | "SYSTEM";
  sender_name: string;
  content: string;
  attachments?: MessageAttachment[];
  sequence: number;
  previous_hash?: string;
  integrity_hash: string;
  created_at: string;
  is_read?: boolean;
}

export interface DealRoom {
  id: string;
  interest_id?: string;
  project_id: number | string;
  project_title: string;
  project_industry?: string;
  founder_id: string;
  founder_name: string;
  founder_email: string;
  founder_company?: string;
  investor_id: string;
  investor_name: string;
  investor_firm?: string;
  investor_email?: string;
  stage: "INTRO_ACCEPTED" | "DUE_DILIGENCE" | "TERM_SHEET" | "PARTNER_MEETING" | "CLOSED" | "PASSED";
  nda_signed: boolean;
  nda_signed_at?: string;
  nda_signer_name?: string;
  shared_documents?: MessageAttachment[];
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  last_message_sender?: string;
  messages_count: number;
  audit_trail_hash: string;
  is_secure_recording_active: boolean;
}

export interface DealRoomAuditLog {
  id: string;
  room_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  actor_name: string;
  details: Record<string, any>;
  tamper_hash: string;
  timestamp: string;
}

export interface DealRoomTranscript {
  export_id: string;
  exported_at: string;
  deal_room_id: string;
  project_title: string;
  founder: { name: string; email: string; company?: string };
  investor: { name: string; firm?: string; email?: string };
  deal_stage: string;
  nda_status: string;
  nda_signed_at?: string;
  total_messages: number;
  cryptographic_integrity_status: string;
  latest_audit_hash: string;
  conversation_records: Array<{
    sequence: number;
    timestamp: string;
    sender: string;
    content: string;
    attachments: string[];
    sha256_signature: string;
  }>;
  audit_trail_summary: Array<{
    event: string;
    actor: string;
    timestamp: string;
    hash: string;
  }>;
  legal_disclaimer: string;
}


