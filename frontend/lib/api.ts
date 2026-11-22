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
  throw new Error(typeof detail === "string" ? detail : `${fallback} (HTTP ${res.status})`);
}

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  role?: "FOUNDER" | "INVESTOR" | null;
  organization?: string | null;
};


// In-memory working copies for local interactive state

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


