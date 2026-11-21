import {
  Project,
  ProjectCreateInput,
  InvestorPreference,
  MatchItem,
  NotificationItem,
  ProjectInterest,
  DealRoom,
  DealMessage,
  DealRoomTranscript,
  DealRoomAuditLog,
  MessageAttachment,
  ProjectDocument,
  ReadinessReport,
  AnalysisHistoryItem,
} from "@/types";
import { clearApiToken, getApiToken } from "@/lib/auth/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * fetch() against the FastAPI backend, attaching the signed-in user's
 * Neon Auth JWT as a Bearer token when there is a session.
 */
async function apiFetch(input: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  let sentToken = false;
  if (typeof window !== "undefined" && !headers.has("Authorization")) {
    const token = await getApiToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      sentToken = true;
    }
  }
  const res = await fetch(input, { ...init, headers });
  // A cached token can expire or belong to an ended session: refresh once and retry.
  if (res.status === 401 && sentToken && !retried && !(init.body instanceof ReadableStream)) {
    clearApiToken();
    return apiFetch(input, init, true);
  }
  return res;
}

/** Throw an Error carrying the API's `detail` message for a failed response. */
async function throwForStatus(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  throw new Error(typeof detail === "string" ? detail : `${fallback} (HTTP ${res.status})`);
}

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  role?: "FOUNDER" | "INVESTOR" | null;
  organization?: string | null;
};


export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    founder_id: 1,
    title: "NeuroPulse AI",
    tagline: "Ultra-low latency AI diagnostic platform for cardiovascular anomaly detection.",
    description:
      "NeuroPulse AI combines edge neuromorphic algorithms with ultra-compact hospital monitors to detect ventricular arrhythmia 4 minutes earlier than current standard ICU telemetry.",
    problem:
      "ICU staff suffer from alarm fatigue with over 85% false alarms, while critical sudden decompensations still slip through delayed algorithmic detection windows.",
    solution:
      "A real-time edge neural processor that decodes continuous 12-lead waveforms directly at bedside without cloud roundtrip latency, delivering 99.4% precision.",
    industry: "Healthcare & AI",
    stage: "Seed",
    funding_required: 750000,
    business_model: "B2B Enterprise SaaS + Hospital Hardware Lease",
    target_market: "Tier-1 Academic Medical Centers & Regional ICU Networks ($14B TAM)",
    website: "https://neuropulse.demo",
    pitch_deck_url: "https://neuropulse.demo/deck.pdf",
    readiness_score: 94,
    ai_readiness_breakdown: {
      problem_solution_fit: 96,
      market_sizing: 91,
      business_model_clarity: 93,
      traction_feasibility: 95,
    },
    ai_feedback_summary:
      "Strong clinical defensibility with clear regulatory roadmap. Pilot data from 2 hospital trials validates low false-positive rate. Pitch deck excels in unit economics.",
    created_at: "2026-09-15T10:00:00Z",
  },
  {
    id: 2,
    founder_id: 2,
    title: "Verdant Chain",
    tagline: "Satellite-verified automated carbon mitigation & supply-chain ledger.",
    description:
      "Verdant Chain utilizes multispectral satellite imagery coupled with IoT soil telemetry to instantly audit and tokenize enterprise carbon offsets with zero greenwashing.",
    problem:
      "Enterprise ESG compliance is hindered by fraudulent voluntary carbon credits, opaque measurement methodologies, and slow manual field auditing.",
    solution:
      "Automated verification pipeline combining orbital synthetic aperture radar (SAR) with cryptographically sealed soil probes, giving continuous verified proof of sequestration.",
    industry: "ClimateTech",
    stage: "MVP / Beta",
    funding_required: 1200000,
    business_model: "Usage-Based API + Audit Verification Fee",
    target_market: "Global Fortune 500 Manufacturing and Agriculture conglomerates ($22B TAM)",
    website: "https://verdantchain.demo",
    pitch_deck_url: "https://verdantchain.demo/deck.pdf",
    readiness_score: 88,
    ai_readiness_breakdown: {
      problem_solution_fit: 89,
      market_sizing: 92,
      business_model_clarity: 84,
      traction_feasibility: 87,
    },
    ai_feedback_summary:
      "Huge market tailwind driven by EU CSRD regulations. Recommend clarifying enterprise sales cycle duration and onboarding velocity in the commercial expansion slide.",
    created_at: "2026-09-20T14:30:00Z",
  },
  {
    id: 3,
    founder_id: 3,
    title: "CyberSentinel Edge",
    tagline: "Autonomous post-quantum cryptographic defenses for industrial IoT.",
    description:
      "Lightweight microkernel architecture protecting SCADA pipelines and power grids from impending harvest-now-decrypt-later quantum compute vector attacks.",
    problem:
      "Legacy critical infrastructure relies on RSA/ECC encryption that will be rendered obsolete by emerging quantum algorithms, with zero zero-downtime upgrade path.",
    solution:
      "Drop-in hardware-accelerated lattice cryptography module deployed as a transparent bump-in-the-wire for substation controllers.",
    industry: "Cybersecurity",
    stage: "Seed",
    funding_required: 1500000,
    business_model: "Annual Per-Node Licensing + OEM Integration",
    target_market: "National Energy Grids, Municipal Water Systems, Aerospace ($18B TAM)",
    website: "https://cybersentinel.demo",
    pitch_deck_url: "https://cybersentinel.demo/deck.pdf",
    readiness_score: 91,
    ai_readiness_breakdown: {
      problem_solution_fit: 94,
      market_sizing: 88,
      business_model_clarity: 90,
      traction_feasibility: 92,
    },
    ai_feedback_summary:
      "Exceptional technical depth from founders with DARPA research pedigree. Defense procurement certification in progress.",
    created_at: "2026-09-28T09:15:00Z",
  },
  {
    id: 4,
    founder_id: 4,
    title: "OmniFlow Robotics",
    tagline: "Adaptive vision-guided warehouse micro-fulfillment robots.",
    description:
      "Vision-language-action (VLA) foundation model running on low-power mobile manipulators for high-mix palletizing and rapid cold-storage parcel sorting.",
    problem:
      "E-commerce fulfillment centers face severe labor shortages and 40% annual turnover in refrigerated sorting environments.",
    solution:
      "Autonomous mobile manipulators that learn new SKU geometries in under 30 seconds without manual retraining or CAD models.",
    industry: "Robotics",
    stage: "Prototype",
    funding_required: 2000000,
    business_model: "Robotics-as-a-Service (RaaS) Monthly Subscription",
    target_market: "3PL Logistics and Grocery Fulfillment Providers ($30B TAM)",
    website: "https://omniflow.demo",
    pitch_deck_url: "https://omniflow.demo/deck.pdf",
    readiness_score: 85,
    ai_readiness_breakdown: {
      problem_solution_fit: 88,
      market_sizing: 86,
      business_model_clarity: 82,
      traction_feasibility: 84,
    },
    ai_feedback_summary:
      "Compelling unit economics on RaaS model. Focus on reducing hardware BOM costs before full manufacturing scale-out.",
    created_at: "2026-10-02T11:45:00Z",
  },
];

export const MOCK_MATCHES: MatchItem[] = [
  {
    id: "match-001",
    project_id: 1,
    project_title: "NeuroPulse AI",
    investor_id: 101,
    investor_name: "Dr. Sarah Lin",
    investor_firm: "Apex Horizon Ventures",
    match_score: 96.4,
    reasons: [
      {
        category: "Industry Focus",
        explanation: "Apex Horizon thesis specifically prioritizes Healthcare AI and DeepTech diagnostics.",
        weight: 0.45,
      },
      {
        category: "Stage Alignment",
        explanation: "Founder is raising Seed round ($750K), matching fund's target check sweet spot ($500K-$1.5M).",
        weight: 0.35,
      },
      {
        category: "Business Model",
        explanation: "Enterprise hospital SaaS model synergizes directly with existing portfolio health system network.",
        weight: 0.2,
      },
    ],
    status: "recommended",
  },
  {
    id: "match-002",
    project_id: 1,
    project_title: "NeuroPulse AI",
    investor_id: 102,
    investor_name: "Marcus Sterling",
    investor_firm: "BlueShift Capital",
    match_score: 89.2,
    reasons: [
      {
        category: "Technology Match",
        explanation: "Fund is actively deploying into edge machine learning and specialized neural hardware.",
        weight: 0.5,
      },
      {
        category: "Geographic Preference",
        explanation: "Global mandate with strong North American co-investment syndicates.",
        weight: 0.3,
      },
      {
        category: "Lead Syndicate",
        explanation: "Frequently acts as lead institutional investor for deep technical founders.",
        weight: 0.2,
      },
    ],
    status: "recommended",
  },
  {
    id: "match-003",
    project_id: 2,
    project_title: "Verdant Chain",
    investor_id: 103,
    investor_name: "Elena Rostova",
    investor_firm: "TerraNext Climate Fund",
    match_score: 93.8,
    reasons: [
      {
        category: "Sector Specialty",
        explanation: "Dedicated $150M fund for carbon verification, satellite tracking, and decarbonization supply chains.",
        weight: 0.6,
      },
      {
        category: "Target Check Size",
        explanation: "Seeking $1.2M matches TerraNext's typical co-investment initial participation range.",
        weight: 0.4,
      },
    ],
    status: "recommended",
  },
  {
    id: "match-004",
    project_id: 3,
    project_title: "CyberSentinel Edge",
    investor_id: 104,
    investor_name: "David Vance",
    investor_firm: "Aegis Defense Partners",
    match_score: 92.1,
    reasons: [
      {
        category: "Dual-Use Tech Focus",
        explanation: "Exclusively funds critical infrastructure security and post-quantum defense algorithms.",
        weight: 0.55,
      },
      {
        category: "Government Network",
        explanation: "Provides direct advisory access to DoD and commercial energy procurement teams.",
        weight: 0.45,
      },
    ],
    status: "recommended",
  },
];

export const MOCK_INVESTOR_PREFERENCE: InvestorPreference = {
  id: 1,
  investor_id: 101,
  preferred_industries: ["Healthcare & AI", "AI/ML", "BioTech", "Cybersecurity"],
  preferred_stages: ["Seed", "Pre-seed", "Series A"],
  min_investment: 500000,
  max_investment: 1500000,
  preferred_business_models: ["B2B SaaS", "Enterprise Infrastructure", "DeepTech IP Licensing"],
  geography: "North America & Europe",
  tech_preferences: ["Edge Machine Learning", "Bioinformatics", "Generative AI & LLMs"],
};

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-001",
    user_id: "founder-001",
    target_role: "FOUNDER",
    title: "New 96.4% Mandate Match",
    desc: "Dr. Sarah Lin (Apex Horizon Ventures) matches your $750k Seed ask for Healthcare AI.",
    time: "20m ago",
    badge: "Match",
    badge_variant: "success",
    read: false,
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-002",
    user_id: "founder-001",
    target_role: "FOUNDER",
    title: "AI Readiness Re-evaluation Complete",
    desc: "Your readiness score improved from 88.0 to 92.4 following clinical pilot data upload.",
    time: "2h ago",
    badge: "Analysis",
    badge_variant: "primary",
    read: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-003",
    user_id: "founder-001",
    target_role: "FOUNDER",
    title: "Confidentiality Check: Private Status Active",
    desc: "Your project 'QuantaShield' remains in private draft mode. Only you can view this report.",
    time: "1d ago",
    badge: "Security",
    badge_variant: "secondary",
    read: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-004",
    user_id: "investor-001",
    target_role: "INVESTOR",
    title: "Founder Approved Dealflow Available",
    desc: "NeuroPulse AI has made verified deck materials accessible to Apex Horizon Ventures.",
    time: "1h ago",
    badge: "Dealflow",
    badge_variant: "success",
    read: false,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-005",
    user_id: "investor-001",
    target_role: "INVESTOR",
    title: "New High-Cosine Match: Verdant Chain",
    desc: "ClimateTech startup raising $1.2M matches your ESG infrastructure mandate at 93.8%.",
    time: "4h ago",
    badge: "Match",
    badge_variant: "primary",
    read: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
];

// In-memory working copies for local interactive state
let localProjects: Project[] = [...MOCK_PROJECTS];
let localPreferences: InvestorPreference = { ...MOCK_INVESTOR_PREFERENCE };
let localNotifications: NotificationItem[] = [...MOCK_NOTIFICATIONS];

export const api = {
  /** The signed-in user and their VentureX role (null role = not onboarded). */
  async getMe(): Promise<MeResponse | null> {
    const res = await apiFetch(`${API_BASE_URL}/me`, { cache: "no-store" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Could not load your account (HTTP ${res.status})`);
    return res.json();
  },

  /** One-time onboarding after sign-up: choose FOUNDER or INVESTOR. */
  async completeOnboarding(data: {
    role: "FOUNDER" | "INVESTOR";
    name?: string;
    organization?: string;
  }): Promise<MeResponse> {
    const res = await apiFetch(`${API_BASE_URL}/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.detail || `Could not finish setting up your account (HTTP ${res.status})`);
    }
    return res.json();
  },

  async checkHealth(): Promise<{ status: string; service?: string; database?: string; version?: string }> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
      if (res.ok) {
        return await res.json();
      }
      return { status: "mock", service: "Venture X Local Mode" };
    } catch {
      return { status: "mock", service: "Venture X Local Mode" };
    }
  },

  async getProjects(myProjects?: boolean): Promise<Project[]> {
    try {
      const url = new URL(`${API_BASE_URL}/projects`);
      if (myProjects) {
        url.searchParams.set("founder_only", "true");
      }
      const headers: Record<string, string> = {};

      const res = await apiFetch(url.toString(), { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        // An empty list is a real answer (e.g. a new account); sample data is only for an unreachable backend.
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback to local projects
    }
    return localProjects;
  },

  async getProject(id: number | string): Promise<Project | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}`, { cache: "no-store" });
      // The backend answered: a 404 means "not found or not yours", not "show a sample project".
      return res.ok ? await res.json() : null;
    } catch {
      // Backend unreachable: fall back to local sample data
    }
    return localProjects.find((p) => String(p.id) === String(id)) || null;
  },

  async createProject(data: ProjectCreateInput): Promise<Project> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const res = await apiFetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      await throwForStatus(res, "Could not create the project");
      const created = await res.json();
      localProjects.unshift(created);
      return created;
    } catch (err) {
      // Real API errors (validation, auth) surface to the form; only a down backend uses local mode.
      if (!(err instanceof TypeError)) throw err;
    }

    // Local simulation with AI analysis scoring
    const score = Math.floor(Math.random() * 12) + 84;
    const newProject: Project = {
      id: Date.now(),
      founder_id: 1,
      ...data,
      readiness_score: score,
      ai_readiness_breakdown: {
        problem_solution_fit: Math.min(100, score + 2),
        market_sizing: Math.max(70, score - 3),
        business_model_clarity: Math.max(75, score - 1),
        traction_feasibility: Math.min(100, score + 1),
      },
      ai_feedback_summary:
        "AI Assessment: Compelling narrative and targeted market pain point. Ready for qualified investor review.",
      created_at: new Date().toISOString(),
    };
    localProjects.unshift(newProject);
    return newProject;
  },

  async updateProject(id: number | string, data: Partial<ProjectCreateInput>): Promise<Project> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const res = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      await throwForStatus(res, "Could not save the project");
      const updated = await res.json();
      const idx = localProjects.findIndex((p) => String(p.id) === String(id));
      if (idx !== -1) localProjects[idx] = updated;
      return updated;
    } catch (err) {
      // Real API errors (validation, ownership) surface to the form; only a down backend uses local mode.
      if (!(err instanceof TypeError)) throw err;
    }

    const idx = localProjects.findIndex((p) => String(p.id) === String(id));
    if (idx !== -1) {
      localProjects[idx] = { ...localProjects[idx], ...data, updated_at: new Date().toISOString() };
      return localProjects[idx];
    }
    throw new Error(`Project ${id} not found`);
  },

  async togglePublishProject(
    id: number | string,
    isPublished: boolean = true
  ): Promise<{ id: string | number; is_published: boolean }> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: isPublished }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return { id, is_published: isPublished };
  },

  // ---- AI project intelligence -------------------------------------------

  async getProjectDocuments(projectId: number | string): Promise<ProjectDocument[]> {
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/documents`, { cache: "no-store" });
    await throwForStatus(res, "Could not load project materials");
    return res.json();
  },

  async uploadProjectDocument(
    projectId: number | string,
    file: File,
    category: string = "supporting_document"
  ): Promise<ProjectDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/documents`, { method: "POST", body: form });
    await throwForStatus(res, `Could not upload ${file.name}`);
    return res.json();
  },

  async deleteProjectDocument(projectId: number | string, docId: number): Promise<void> {
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/documents/${docId}`, { method: "DELETE" });
    await throwForStatus(res, "Could not remove the document");
  },

  /** Download a private project document (it needs the auth header, so a plain link would not work). */
  async downloadProjectDocument(doc: ProjectDocument): Promise<void> {
    const base = API_BASE_URL.replace(/\/api$/, "");
    const res = await apiFetch(`${base}${doc.url}`);
    await throwForStatus(res, "Could not download the document");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.original_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async getReadinessReport(projectId: number | string): Promise<ReadinessReport | null> {
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/readiness`, { cache: "no-store" });
    if (res.status === 404) return null;
    await throwForStatus(res, "Could not load the readiness report");
    return res.json();
  },

  /** Run a fresh analysis of the profile, materials and repository. Takes a minute or two with Claude. */
  async analyzeProject(projectId: number | string): Promise<ReadinessReport> {
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/analyze`, { method: "POST" });
    await throwForStatus(res, "The analysis could not be completed");
    return res.json();
  },

  async getProjectAnalyses(projectId: number | string): Promise<AnalysisHistoryItem[]> {
    const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/analyses`, { cache: "no-store" });
    await throwForStatus(res, "Could not load analysis history");
    return res.json();
  },

  async getProjectReadiness(id: number | string): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}/readiness`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return null;
  },

  async reEvaluateProject(id: number | string): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}/re-evaluate`, {
        method: "POST",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return null;
  },

  async getMatches(): Promise<MatchItem[]> {
    try {
      const headers: Record<string, string> = {};

      const res = await apiFetch(`${API_BASE_URL}/matches`, { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        // An empty list is a real answer (e.g. a new account); sample data is only for an unreachable backend.
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return MOCK_MATCHES;
  },

  async getInvestorPreferences(): Promise<InvestorPreference> {
    try {
      const headers: Record<string, string> = {};

      const res = await apiFetch(`${API_BASE_URL}/investors/preferences`, { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data) return data;
      }
    } catch {
      // Fallback
    }
    return localPreferences;
  },

  async updateInvestorPreferences(prefs: Partial<InvestorPreference>): Promise<InvestorPreference> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const res = await apiFetch(`${API_BASE_URL}/investors/preferences`, {
        method: "PUT",
        headers,
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        const updated = await res.json();
        localPreferences = updated;
        return updated;
      }
    } catch {
      // Fallback
    }
    localPreferences = { ...localPreferences, ...prefs };
    return localPreferences;
  },

  async getFounderProfile(): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/founders/profile`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateFounderProfile(data: any): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/founders/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return data;
  },

  async getFounderSettings(): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/founders/settings`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateFounderSettings(data: any): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/founders/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return data;
  },

  async getInvestorProfile(): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/investors/profile`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateInvestorProfile(data: any): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/investors/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return data;
  },

  async getInvestorSettings(): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/investors/settings`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateInvestorSettings(data: any): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/investors/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return data;
  },

  async expressInterest(data: {
    project_id: number | string;
    note?: string;
    message?: string;
    investor_id?: string;
    project_title?: string;
    project_industry?: string;
  }): Promise<ProjectInterest> {
    const message =
      data.message ||
      data.note ||
      "Introduction requested for confidential data room review.";
    try {
      const res = await apiFetch(`${API_BASE_URL}/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: data.project_id,
          investor_id: data.investor_id || "investor-001",
          message,
        }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback for offline/mock mode
    }
    const matchedProject = localProjects.find(
      (p) => String(p.id) === String(data.project_id)
    );
    return {
      id: `intro-${data.project_id}-${data.investor_id || "investor-001"}`,
      project_id: data.project_id,
      project_title:
        data.project_title ||
        matchedProject?.title ||
        `Project #${data.project_id}`,
      project_industry:
        data.project_industry || matchedProject?.industry || "DeepTech",
      investor_id: data.investor_id || "investor-001",
      investor_name: "Dr. Sarah Lin",
      investor_firm: "Apex Horizon Ventures",
      status: "pending",
      message,
      created_at: new Date().toISOString(),
    };
  },

  async withdrawInterest(interestId: string | number): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/interests/${interestId}`, {
        method: "DELETE",
      });
      if (res.ok) return true;
    } catch {
      // Fallback
    }
    return false;
  },

  async getInterests(params?: { investor_id?: string; founder_id?: string; status?: string }): Promise<any[]> {
    try {
      const url = new URL(`${API_BASE_URL}/interests`);
      if (params?.investor_id) url.searchParams.set("investor_id", params.investor_id);
      if (params?.founder_id) url.searchParams.set("founder_id", params.founder_id);
      if (params?.status) url.searchParams.set("status", params.status);
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async updateInterestStatus(
    interestId: string | number,
    status: "accepted" | "declined" | "pending",
    responseNote?: string
  ): Promise<any> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/interests/${interestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, response_note: responseNote }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return { id: interestId, status };
  },

  // Notifications are always the signed-in user's own (the backend scopes them by token).
  // The `role` argument is kept for existing callers and ignored. On any failure these return
  // empty results: never sample data.
  async getNotifications(role?: "FOUNDER" | "INVESTOR", unreadOnly?: boolean): Promise<NotificationItem[]> {
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.append("unread_only", "true");
      const res = await apiFetch(`${API_BASE_URL}/notifications?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // network error: show nothing rather than sample data
    }
    return [];
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUnreadNotificationCount(role?: "FOUNDER" | "INVESTOR"): Promise<number> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/notifications/unread-count`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return data.unread_count ?? 0;
      }
    } catch {
      // network error
    }
    return 0;
  },

  async markNotificationRead(id: string | number): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (res.ok) return true;
    } catch {
      // Fallback
    }
    const target = localNotifications.find((n) => String(n.id) === String(id));
    if (target) {
      target.read = true;
      return true;
    }
    return false;
  },

  async markAllNotificationsRead(role?: "FOUNDER" | "INVESTOR", userId?: string): Promise<number> {
    try {
      const params = new URLSearchParams();
      if (role) params.append("role", role);
      if (userId) params.append("user_id", userId);
      const res = await apiFetch(`${API_BASE_URL}/notifications/mark-all-read?${params.toString()}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        return data.modified_count ?? 0;
      }
    } catch {
      // Fallback
    }
    let count = 0;
    localNotifications.forEach((n) => {
      if (!role || n.target_role === role) {
        if (!n.read) count++;
        n.read = true;
      }
    });
    return count;
  },

  // Deal Room & Secure Messaging API
  async getDealRooms(params?: { user_id?: string; role?: string }): Promise<DealRoom[]> {
    try {
      const url = new URL(`${API_BASE_URL}/dealrooms`);
      if (params?.user_id) url.searchParams.set("user_id", params.user_id);
      if (params?.role) url.searchParams.set("role", params.role);
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async getDealRoom(roomId: string, userId?: string): Promise<DealRoom | null> {
    try {
      const url = new URL(`${API_BASE_URL}/dealrooms/${roomId}`);
      if (userId) url.searchParams.set("user_id", userId);
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async getDealRoomMessages(roomId: string, userId?: string): Promise<DealMessage[]> {
    try {
      const url = new URL(`${API_BASE_URL}/dealrooms/${roomId}/messages`);
      if (userId) url.searchParams.set("user_id", userId);
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async sendDealRoomMessage(
    roomId: string,
    message: {
      sender_id: string;
      sender_role: "FOUNDER" | "INVESTOR";
      sender_name: string;
      content: string;
      attachments?: MessageAttachment[];
    }
  ): Promise<DealMessage | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateDealRoomStage(
    roomId: string,
    stageData: {
      stage: string;
      note?: string;
      sender_id: string;
      sender_role: string;
      sender_name: string;
    }
  ): Promise<DealRoom | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stageData),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async signDealRoomNDA(
    roomId: string,
    ndaData: { signer_id: string; signer_role: string; signer_name: string }
  ): Promise<DealRoom | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/nda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ndaData),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async shareDealRoomDocument(
    roomId: string,
    docData: {
      name: string;
      url: string;
      type: string;
      size_kb?: number;
      sender_id: string;
      sender_role: string;
      sender_name: string;
    }
  ): Promise<DealRoom | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docData),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async getDealRoomTranscript(roomId: string, userId?: string): Promise<DealRoomTranscript | null> {
    try {
      const url = new URL(`${API_BASE_URL}/dealrooms/${roomId}/transcript`);
      if (userId) url.searchParams.set("user_id", userId);
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async getDealRoomAuditLogs(roomId: string): Promise<DealRoomAuditLog[]> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/audit-logs`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  /**
   * Upload a file into a deal room. The backend stores it privately; only the room's two
   * participants can download it (see downloadDealRoomFile). Throws with the server's message.
   */
  async uploadDealRoomFile(roomId: string, file: File, name: string, type: string): Promise<DealRoom> {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    form.append("type", type);
    const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/files`, { method: "POST", body: form });
    await throwForStatus(res, "Could not upload the file");
    return res.json();
  },

  /** True for a file stored in a deal room (downloaded with the user's token), false for an external link. */
  isDealRoomFile(url: string): boolean {
    return /^\/dealrooms\/[A-Za-z0-9_-]+\/files\/[0-9a-f]{32}$/.test(url);
  },

  async downloadDealRoomFile(url: string, name: string): Promise<void> {
    const res = await apiFetch(`${API_BASE_URL}${url}`);
    await throwForStatus(res, "Could not download the file");
    const objectUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  },

  async downloadProjectReadinessPDF(
    projectId: number | string,
    projectTitle: string = "Startup"
  ): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/export-report`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VentureX_Readiness_Report_${projectTitle.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  },

  async downloadDealRoomPDF(
    roomId: string,
    projectTitle: string = "DealRoom"
  ): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/dealrooms/${roomId}/export-pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VentureX_Audit_Transcript_${projectTitle.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  },
};


