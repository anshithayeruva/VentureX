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
  CriteriaOptions,
  DealFlow,
  AdminCompanyRow,
  AdminInvestorRow,
  CompanyVerification,
  InvestorVerification,
  InvestorVerificationStatus,
  PortfolioEntry,
  RegistrationType,
  ReviewDecision,
  DirectoryQuery,
  InvestorDirectory,
  PassReason,
  PublicInvestorProfile,
  DiscoverPage,
  DiscoverQuery,
  InvestmentDetail,
  InvestmentInput,
  InvestmentPatch,
  InvestmentThesis,
  PortfolioImportResult,
  PortfolioSummary,
  TransactionInput,
  TransactionPage,
  TransactionType,
  ValuationInput,
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
/** Run a request; a network failure (server unreachable) becomes a readable error. */
async function networkSafe(request: () => Promise<Response>): Promise<Response> {
  try {
    return await request();
  } catch {
    throw new Error("Can't reach VentureX right now. Check your connection and try again.");
  }
}

async function throwForStatus(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object" && typeof detail.message === "string") throw new Error(detail.message);
  if (Array.isArray(detail) && detail[0]?.msg) {
    const msg = String(detail[0].msg).replace(/^Value error, /, "");
    throw new Error(msg.charAt(0).toUpperCase() + msg.slice(1));
  }
  throw new Error(`${fallback} (HTTP ${res.status})`);
}

/** GET a JSON resource; throws a readable error on failure. */
async function getJson<T>(url: string, fallback: string): Promise<T> {
  const res = await networkSafe(() => apiFetch(url, { cache: "no-store" }));
  await throwForStatus(res, fallback);
  return res.json();
}

/** Send JSON with a method; throws a readable error (the API's validation message) on failure. */
async function sendJson<T>(method: string, url: string, body: unknown, fallback: string): Promise<T> {
  const res = await networkSafe(() =>
    apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  );
  await throwForStatus(res, fallback);
  return res.json();
}

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  role?: "FOUNDER" | "INVESTOR" | null;
  organization?: string | null;
  is_admin?: boolean;
  verification_status?: InvestorVerificationStatus | null;
  verification_required?: boolean;
};


// In-memory working copies for local interactive state

export const api = {
  /** The signed-in user and their VentureX role (null role = not onboarded). */
  async getMe(): Promise<MeResponse | null> {
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/me`, { cache: "no-store" }));
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
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }));
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

  // Reads return empty / null when the backend can't be reached; writes throw so the page can
  // show the real problem. Nothing here ever substitutes sample data.
  async getProjects(myProjects?: boolean): Promise<Project[]> {
    try {
      const url = new URL(`${API_BASE_URL}/projects`);
      if (myProjects) url.searchParams.set("founder_only", "true");
      const res = await apiFetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // network error
    }
    return [];
  },

  async getProject(id: number | string): Promise<Project | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}`, { cache: "no-store" });
      // A 404 means "not found or not yours".
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  async createProject(data: ProjectCreateInput): Promise<Project> {
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    );
    await throwForStatus(res, "Could not create the project");
    return res.json();
  },

  async updateProject(id: number | string, data: Partial<ProjectCreateInput>): Promise<Project> {
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    );
    await throwForStatus(res, "Could not save the project");
    return res.json();
  },

  async togglePublishProject(
    id: number | string,
    isPublished: boolean = true
  ): Promise<{ id: string | number; is_published: boolean }> {
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/projects/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: isPublished }),
      })
    );
    await throwForStatus(res, isPublished ? "Could not publish the project" : "Could not make the project private");
    return res.json();
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
      const res = await apiFetch(`${API_BASE_URL}/matches`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // network error
    }
    return [];
  },

  /** The signed-in investor's criteria, or null if they couldn't be loaded. */
  async getInvestorPreferences(): Promise<InvestorPreference | null> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/investors/preferences`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // network error
    }
    return null;
  },

  async updateInvestorPreferences(prefs: Partial<InvestorPreference>): Promise<InvestorPreference> {
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/investors/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
    );
    await throwForStatus(res, "Could not save your criteria");
    return res.json();
  },

  /* ---------------------------------------------------------- investor portal */
  // These throw on failure so pages can show a real error state instead of empty data.

  async getCriteriaOptions(): Promise<CriteriaOptions> {
    return getJson(`${API_BASE_URL}/investors/criteria-options`, "Could not load criteria options");
  },

  async saveThesis(thesis: InvestmentThesis): Promise<InvestorPreference> {
    return sendJson("PUT", `${API_BASE_URL}/investors/preferences`, { thesis }, "Could not save your criteria");
  },

  async discover(query: DiscoverQuery): Promise<DiscoverPage> {
    const url = new URL(`${API_BASE_URL}/investors/discover`);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "" || value === false) continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
      else url.searchParams.set(key, String(value));
    }
    return getJson(url.toString(), "Could not load startups");
  },

  async setSaved(projectId: number | string, saved: boolean): Promise<void> {
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/investors/saved/${projectId}`, { method: saved ? "PUT" : "DELETE" })
    );
    await throwForStatus(res, saved ? "Could not save this startup" : "Could not remove it from saved");
  },

  /* ---------- verification ---------- */

  async getInvestorVerification(): Promise<InvestorVerification> {
    return getJson(`${API_BASE_URL}/investors/verification`, "Could not load your verification");
  },

  async submitInvestorVerification(data: { linkedin_url: string; website: string; past_investments: PortfolioEntry[] }): Promise<InvestorVerification> {
    return sendJson("POST", `${API_BASE_URL}/investors/verification`, data, "Could not send your evidence");
  },

  async getCompanyVerification(projectId: number | string): Promise<CompanyVerification> {
    return getJson(`${API_BASE_URL}/projects/${projectId}/verification`, "Could not load company verification");
  },

  async sendCompanyCode(projectId: number | string, email: string): Promise<CompanyVerification> {
    return sendJson("POST", `${API_BASE_URL}/projects/${projectId}/verification/email`, { email }, "Could not send the code");
  },

  async confirmCompanyCode(projectId: number | string, code: string): Promise<CompanyVerification> {
    return sendJson("POST", `${API_BASE_URL}/projects/${projectId}/verification/confirm`, { code }, "Could not check the code");
  },

  async submitCompanyRegistration(projectId: number | string, registration_type: RegistrationType, registration_number: string, note?: string): Promise<CompanyVerification> {
    return sendJson("POST", `${API_BASE_URL}/projects/${projectId}/verification/registration`,
      { registration_type, registration_number, note: note || null }, "Could not send the registration number");
  },

  async getAdminCounts(): Promise<{ investors_pending: number; companies_pending: number }> {
    return getJson(`${API_BASE_URL}/admin/verifications/counts`, "Could not load the review queue");
  },

  async getAdminInvestors(status?: string): Promise<AdminInvestorRow[]> {
    const url = new URL(`${API_BASE_URL}/admin/verifications`);
    url.searchParams.set("kind", "investor");
    if (status) url.searchParams.set("status", status);
    return getJson(url.toString(), "Could not load the review queue");
  },

  async getAdminCompanies(status?: string): Promise<AdminCompanyRow[]> {
    const url = new URL(`${API_BASE_URL}/admin/verifications`);
    url.searchParams.set("kind", "company");
    if (status) url.searchParams.set("status", status);
    return getJson(url.toString(), "Could not load the review queue");
  },

  async reviewInvestor(userId: string, decision: ReviewDecision, note?: string): Promise<unknown> {
    return sendJson("POST", `${API_BASE_URL}/admin/investors/${encodeURIComponent(userId)}/review`,
      { decision, note: note || null }, "Could not save the review");
  },

  async reviewCompany(projectId: number, decision: ReviewDecision, note?: string): Promise<unknown> {
    return sendJson("POST", `${API_BASE_URL}/admin/companies/${projectId}/review`,
      { decision, note: note || null }, "Could not save the review");
  },

  /* ---------- founder outreach ---------- */

  async getInvestorDirectory(query: DirectoryQuery = {}): Promise<InvestorDirectory> {
    const url = new URL(`${API_BASE_URL}/founders/investors`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    return getJson(url.toString(), "Could not load investors");
  },

  async getInvestorForFounder(investorId: string, projectId?: number): Promise<PublicInvestorProfile | null> {
    const url = new URL(`${API_BASE_URL}/founders/investors/${encodeURIComponent(investorId)}`);
    if (projectId) url.searchParams.set("project_id", String(projectId));
    const res = await networkSafe(() => apiFetch(url.toString(), { cache: "no-store" }));
    if (res.status === 404) return null;
    await throwForStatus(res, "Could not load this investor");
    return res.json();
  },

  async requestIntroFromInvestor(investorId: string, projectId: number, note: string): Promise<ProjectInterest> {
    return sendJson("POST", `${API_BASE_URL}/founders/investors/${encodeURIComponent(investorId)}/intro-requests`,
      { project_id: projectId, note }, "Could not send the intro request");
  },

  /** Investor's reply to a founder's request: Interested opens the deal room; Pass needs a reason. */
  async respondToIntro(interestId: string | number, decision: "interested" | "pass", reason?: PassReason, note?: string): Promise<ProjectInterest> {
    return sendJson("POST", `${API_BASE_URL}/interests/${interestId}/respond`,
      { decision, reason: reason || null, note: note || null }, "Could not send your reply");
  },

  async getDealFlow(): Promise<DealFlow> {
    return getJson(`${API_BASE_URL}/investors/deal-flow`, "Could not load your deal flow");
  },

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    return getJson(`${API_BASE_URL}/portfolio/summary`, "Could not load your portfolio");
  },

  async getTransactions(params: { type?: TransactionType; investment_id?: number; page?: number; page_size?: number } = {}): Promise<TransactionPage> {
    const url = new URL(`${API_BASE_URL}/portfolio/transactions`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    return getJson(url.toString(), "Could not load transactions");
  },

  async getInvestment(id: number | string): Promise<InvestmentDetail | null> {
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/portfolio/investments/${id}`, { cache: "no-store" }));
    if (res.status === 404) return null;
    await throwForStatus(res, "Could not load this investment");
    return res.json();
  },

  async createInvestment(data: InvestmentInput): Promise<InvestmentDetail> {
    return sendJson("POST", `${API_BASE_URL}/portfolio/investments`, data, "Could not record the investment");
  },

  async updateInvestment(id: number, data: InvestmentPatch): Promise<InvestmentDetail> {
    return sendJson("PUT", `${API_BASE_URL}/portfolio/investments/${id}`, data, "Could not update the investment");
  },

  async deleteInvestment(id: number): Promise<void> {
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/portfolio/investments/${id}`, { method: "DELETE" }));
    await throwForStatus(res, "Could not delete the investment");
  },

  async addTransaction(investmentId: number, data: TransactionInput): Promise<InvestmentDetail> {
    return sendJson("POST", `${API_BASE_URL}/portfolio/investments/${investmentId}/transactions`, data, "Could not add the transaction");
  },

  async deleteTransaction(id: number): Promise<void> {
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/portfolio/transactions/${id}`, { method: "DELETE" }));
    await throwForStatus(res, "Could not delete the transaction");
  },

  async addValuation(investmentId: number, data: ValuationInput): Promise<InvestmentDetail> {
    return sendJson("POST", `${API_BASE_URL}/portfolio/investments/${investmentId}/valuations`, data, "Could not add the valuation");
  },

  /** Download a portfolio CSV (holdings, the transaction ledger, or the import template). */
  async downloadPortfolioCsv(kind: "holdings" | "transactions" | "template"): Promise<void> {
    const path = kind === "template" ? "import/template.csv" : `export/${kind}.csv`;
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/portfolio/${path}`, { cache: "no-store" }));
    await throwForStatus(res, "Could not download the file");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "template" ? "venturex-portfolio-template.csv" : `venturex-${kind}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Check (dryRun) or import a portfolio CSV. Nothing is saved when any row has a problem. */
  async importPortfolioCsv(file: File, dryRun: boolean): Promise<PortfolioImportResult> {
    const form = new FormData();
    form.append("file", file);
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/portfolio/import?dry_run=${dryRun}`, { method: "POST", body: form })
    );
    await throwForStatus(res, "Could not read the file");
    return res.json();
  },

  async deleteValuation(id: number): Promise<void> {
    const res = await networkSafe(() => apiFetch(`${API_BASE_URL}/portfolio/valuations/${id}`, { method: "DELETE" }));
    await throwForStatus(res, "Could not delete the valuation");
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
    return sendJson("PUT", `${API_BASE_URL}/investors/profile`, data, "Could not save your profile");
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
    project_title?: string;
    project_industry?: string;
  }): Promise<ProjectInterest> {
    // The investor is always the signed-in user (the backend takes it from the token).
    const message = data.message || data.note || "I'd like to learn more about your project.";
    const res = await networkSafe(() =>
      apiFetch(`${API_BASE_URL}/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: data.project_id, message }),
      })
    );
    await throwForStatus(res, "Could not send the intro request");
    return res.json();
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
      const res = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PATCH" });
      return res.ok;
    } catch {
      return false;
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async markAllNotificationsRead(role?: "FOUNDER" | "INVESTOR"): Promise<number> {
    try {
      const res = await apiFetch(`${API_BASE_URL}/notifications/mark-all-read`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        return data.modified_count ?? 0;
      }
    } catch {
      // network error
    }
    return 0;
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


