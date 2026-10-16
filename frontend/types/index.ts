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
  readiness_score?: number;
  ai_readiness_breakdown?: {
    problem_solution_fit?: number;
    market_sizing?: number;
    business_model_clarity?: number;
    traction_feasibility?: number;
  };
  ai_feedback_summary?: string;
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


