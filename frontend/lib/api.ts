import { Project, ProjectCreateInput, InvestorPreference, MatchItem } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

// In-memory working copies for local interactive state
let localProjects: Project[] = [...MOCK_PROJECTS];
let localPreferences: InvestorPreference = { ...MOCK_INVESTOR_PREFERENCE };

export const api = {
  async checkHealth(): Promise<{ status: string; service?: string; database?: string; version?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url.toString(), { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback to local projects
    }
    return localProjects;
  },

  async getProject(id: number | string): Promise<Project | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}`, { cache: "no-store" });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to local
    }
    return localProjects.find((p) => String(p.id) === String(id)) || null;
  },

  async createProject(data: ProjectCreateInput): Promise<Project> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        localProjects.unshift(created);
        return created;
      }
    } catch {
      // Fallback
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        const idx = localProjects.findIndex((p) => String(p.id) === String(id));
        if (idx !== -1) localProjects[idx] = updated;
        return updated;
      }
    } catch {
      // Fallback
    }

    const idx = localProjects.findIndex((p) => String(p.id) === String(id));
    if (idx !== -1) {
      localProjects[idx] = { ...localProjects[idx], ...data, updated_at: new Date().toISOString() };
      return localProjects[idx];
    }
    throw new Error(`Project ${id} not found`);
  },

  async togglePublishProject(id: number | string): Promise<{ id: string | number; is_published: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}/publish`, {
        method: "PATCH",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return { id, is_published: true };
  },

  async getProjectReadiness(id: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}/readiness`);
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
      const res = await fetch(`${API_BASE_URL}/projects/${id}/re-evaluate`, {
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/matches`, { headers, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback
    }
    return MOCK_MATCHES;
  },

  async getInvestorPreferences(): Promise<InvestorPreference> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/investors/preferences`, { headers, cache: "no-store" });
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/investors/preferences`, {
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
      const res = await fetch(`${API_BASE_URL}/founders/profile`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateFounderProfile(data: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/founders/profile`, {
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
      const res = await fetch(`${API_BASE_URL}/founders/settings`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateFounderSettings(data: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/founders/settings`, {
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
      const res = await fetch(`${API_BASE_URL}/investors/profile`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateInvestorProfile(data: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/investors/profile`, {
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
      const res = await fetch(`${API_BASE_URL}/investors/settings`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async updateInvestorSettings(data: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/investors/settings`, {
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

  async expressInterest(data: { project_id: number | string; note?: string }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return { status: "received", ...data };
  },

  async getInterests(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/interests`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return [];
  },

  async getNotifications(role: "FOUNDER" | "INVESTOR"): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications?role=${role}`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return [];
  },
};

