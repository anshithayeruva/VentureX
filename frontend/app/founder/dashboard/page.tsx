"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Rocket,
  Users,
  Sparkles,
  Layers,
  PlusCircle,
  FileText,
  User,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Settings,
  Edit,
  Download,
  RefreshCw,
  Search,
  Filter,
  Briefcase,
  Mail,
  Phone,
  ExternalLink,
  Calendar,
  MessageSquare,
  Check,
  X,
  Unlock,
  Building2,
  Clock,
  CheckCheck,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProjectCard } from "@/components/ProjectCard";
import { InvestorCard } from "@/components/InvestorCard";
import { StatCard } from "@/components/StatCard";
import { PortalLayout } from "@/components/PortalLayout";
import { api, MOCK_PROJECTS, MOCK_MATCHES } from "@/lib/api";
import { Project, MatchItem, ProjectInterest, NotificationItem } from "@/types";

function FounderDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [matches, setMatches] = useState<MatchItem[]>(MOCK_MATCHES);
  const [interests, setInterests] = useState<ProjectInterest[]>([]);
  const [statusProcessing, setStatusProcessing] = useState<string | null>(null);
  const [introTabFilter, setIntroTabFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [publishedProjects, setPublishedProjects] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
  });


  const [founderProfile, setFounderProfile] = useState({
    name: "Alex Rivers",
    company: "NeuroPulse AI",
    bio: "Founding engineer & biomedical researcher building ultra-low-latency edge diagnostic hardware for cardiology.",
    location: "San Francisco, CA",
    linkedin: "https://linkedin.com/in/alexrivers",
    website: "https://neuropulse.demo",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [investorSearch, setInvestorSearch] = useState("");

  const [settings, setSettings] = useState({
    defaultPrivate: true,
    hideGapsFromInvestors: true,
    emailAlerts: true,
    weeklyDigest: false,
  });

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    let mounted = true;
    api.getProjects(true).then((data) => {
      if (mounted && data.length > 0) {
        setProjects(data);
        const pubMap: Record<number, boolean> = {};
        data.forEach((p: any) => {
          pubMap[p.id] = !!p.is_published;
        });
        setPublishedProjects(pubMap);
      }
    });
    api.getMatches().then((data) => {
      if (mounted && data.length > 0) setMatches(data);
    });
    api.getInterests().then((data) => {
      if (mounted && Array.isArray(data)) setInterests(data);
    });
    api.getFounderProfile().then((data) => {
      if (mounted && data) {
        setFounderProfile((prev) => ({
          ...prev,
          name: data.name || prev.name,
          company: data.company || prev.company,
          bio: data.bio || prev.bio,
          location: data.location || prev.location,
          linkedin: data.linkedin || prev.linkedin,
          website: data.website || prev.website,
        }));
      }
    });
    api.getFounderSettings().then((data) => {
      if (mounted && data) {
        setSettings({
          defaultPrivate: data.default_private ?? true,
          hideGapsFromInvestors: data.hide_gaps_from_investors ?? true,
          emailAlerts: data.email_alerts ?? true,
          weeklyDigest: data.weekly_digest ?? false,
        });
      }
    });
    api.getNotifications("FOUNDER").then((data) => {
      if (mounted && Array.isArray(data)) {
        setNotifications(data);
        setUnreadNotifCount(data.filter((n) => !n.read).length);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleMarkAsRead = async (id: string | number) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await api.markAllNotificationsRead("FOUNDER");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifCount(0);
  };


  const handleUpdateStatus = async (interestId: string | number, status: "accepted" | "declined") => {
    setStatusProcessing(String(interestId));
    try {
      const note = responseNotes[String(interestId)];
      const res = await api.updateInterestStatus(interestId, status, note);
      if (res) {
        setInterests((prev) =>
          prev.map((item) => (String(item.id) === String(interestId) ? { ...item, ...res, status } : item))
        );
      }
    } finally {
      setStatusProcessing(null);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateFounderProfile(founderProfile);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateFounderSettings({
      default_private: settings.defaultPrivate,
      hide_gaps_from_investors: settings.hideGapsFromInvestors,
      email_alerts: settings.emailAlerts,
      weekly_digest: settings.weeklyDigest,
    });
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 3000);
  };

  const togglePublish = async (projectId: number) => {
    setPublishedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
    await api.togglePublishProject(projectId);
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      if (projects.length > 0) {
        const activeProj = projects[0];
        const res = await api.reEvaluateProject(activeProj.id);
        if (res && res.readiness_score) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === activeProj.id
                ? {
                    ...p,
                    readiness_score: res.readiness_score,
                    ai_readiness_breakdown: res.ai_readiness_breakdown,
                    ai_feedback_summary: res.ai_feedback_summary,
                  }
                : p
            )
          );
        }
      }
    } finally {
      setTimeout(() => {
        setReanalyzing(false);
      }, 800);
    }
  };

  const filteredMatches = matches.filter(
    (m) =>
      m.investor_name.toLowerCase().includes(investorSearch.toLowerCase()) ||
      (m.investor_firm && m.investor_firm.toLowerCase().includes(investorSearch.toLowerCase())) ||
      m.project_title.toLowerCase().includes(investorSearch.toLowerCase())
  );

  return (
    <PortalLayout
      role="FOUNDER"
      activeItem={activeTab}
      onSelectItem={(tab) => setActiveTab(tab)}
      title={
        activeTab === "overview"
          ? "Dashboard"
          : activeTab === "projects"
          ? "My Projects"
          : activeTab === "intros"
          ? "Intro Requests & Deal Rooms"
          : activeTab === "readiness"
          ? "AI Readiness Report"
          : activeTab === "investors"
          ? "Investor Discovery"
          : activeTab === "notifications"
          ? "Notifications"
          : activeTab === "profile"
          ? "Profile"
          : "Settings"
      }
    >
      {/* Top Header Bar inside Content */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-8 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary">Founder Workspace</Badge>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#1B3B6F]" /> Private Mode Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
            {activeTab === "overview" && "Founder Dashboard"}
            {activeTab === "projects" && "My Startup Projects"}
            {activeTab === "intros" && "Introduction Requests & Deal Rooms"}
            {activeTab === "readiness" && "AI Pitch Readiness Report"}
            {activeTab === "investors" && "Semantic Investor Discovery"}
            {activeTab === "notifications" && "Founder Notifications"}
            {activeTab === "profile" && "Founder & Company Profile"}
            {activeTab === "settings" && "Workspace & Privacy Settings"}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            {activeTab === "overview" && "Track pitch deck readiness, manage confidential profiles, and review explainable matches."}
            {activeTab === "projects" && "Manage your venture profiles. Control when materials become visible to syndicate investors."}
            {activeTab === "intros" && "Review syndicate introduction requests, approve deal room access, and communicate directly with partners."}
            {activeTab === "readiness" && "Confidential diagnostic evaluation of market sizing, defensibility, and presentation strength."}
            {activeTab === "investors" && "Discover investors whose mandates and past deals align with your sector and check size."}
            {activeTab === "notifications" && "Recent deal room activity, investor interest requests, and analysis updates."}
            {activeTab === "profile" && "Public founder identity and venture metadata presented to matched investors."}
            {activeTab === "settings" && "Control project privacy defaults, confidential report access, and alerts."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/founder/projects/new"
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-all shadow-sm flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Submit New Project
          </Link>
        </div>
      </div>

      {/* 1. Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Top Stat Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Projects"
              value={projects.length}
              change="+1 this quarter"
              icon={Rocket}
              subtext="Confidential workspace"
            />
            <StatCard
              label="AI Readiness Score"
              value="92.4"
              change="Ready for Review"
              icon={Sparkles}
              subtext="Gap Analysis Engine v2"
            />
            <StatCard
              label="Matched Theses"
              value={matches.length}
              change={`${matches.filter(m => m.match_score >= 85).length} High Conviction`}
              icon={Users}
              subtext="Exceeds 85% threshold"
            />
            <StatCard
              label="Intro Requests"
              value={interests.filter((i) => i.status === "pending").length}
              change={
                interests.filter((i) => i.status === "pending").length > 0
                  ? `${interests.filter((i) => i.status === "pending").length} Action Required`
                  : "All Processed"
              }
              icon={TrendingUp}
              subtext="Syndicate partners"
            />
          </div>

          {/* Quick Inbound Intro Requests Review Banner */}
          {interests.filter((i) => i.status === "pending").length > 0 && (
            <div className="rounded-xl border border-[#BFD7EE] bg-[#EBF2FA] p-5 shadow-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#1B3B6F] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] font-display flex items-center gap-2">
                      Inbound Introduction Requests
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1B3B6F] text-white">
                        {interests.filter((i) => i.status === "pending").length} Pending Review
                      </span>
                    </h3>
                    <p className="text-xs text-[#64748B]">Accredited partners requesting confidential data room review.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("intros")}
                  className="text-xs font-semibold text-[#1B3B6F] hover:text-[#142C54]"
                >
                  Manage all ({interests.length}) →
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {interests
                  .filter((i) => i.status === "pending")
                  .slice(0, 2)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0F172A] font-display">{item.investor_name}</span>
                          {item.investor_firm && (
                            <span className="text-xs text-[#64748B] flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#94A3B8]" />
                              {item.investor_firm}
                            </span>
                          )}
                          <Badge variant="primary">{item.project_title || "Startup Project"}</Badge>
                        </div>
                        <p className="text-xs text-[#475569] italic bg-[#F8FAFC] p-2.5 rounded-lg border border-[#F1F5F9]">
                          &quot;{item.message}&quot;
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          disabled={statusProcessing === String(item.id)}
                          onClick={() => handleUpdateStatus(item.id, "accepted")}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#2E7D52] hover:bg-[#256843] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Accept & Unlock Deal Room
                        </button>
                        <button
                          disabled={statusProcessing === String(item.id)}
                          onClick={() => handleUpdateStatus(item.id, "declined")}
                          className="px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Privacy Model Notice Panel */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#1B3B6F] shrink-0 shadow-subtle">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] font-display">Founder Confidentiality Guaranteed</h4>
                <p className="text-xs text-[#64748B] mt-0.5 max-w-2xl leading-relaxed">
                  Projects are <strong>private by default</strong>. Your AI readiness score, weakness diagnostics,
                  and improvement notes are visible only to you. Investors only see information after you explicitly publish.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("settings")}
              className="px-3.5 py-1.5 text-xs font-medium text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#FAFBFD] rounded-lg transition-colors whitespace-nowrap shadow-subtle"
            >
              Privacy Settings
            </button>
          </div>

          {/* Projects Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] font-display">Your Startup Projects</h2>
                <p className="text-xs text-[#64748B]">Profiles currently managed in your founder workspace.</p>
              </div>
              <button
                onClick={() => setActiveTab("projects")}
                className="text-xs font-semibold text-[#1B3B6F] hover:text-[#142C54] flex items-center gap-1"
              >
                View all ({projects.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 3).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>

          {/* Recommended Investors Section */}
          <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] font-display">Top Recommended Investors</h2>
                <p className="text-xs text-[#64748B]">Matches synthesized from sector mandates and past round targets.</p>
              </div>
              <button
                onClick={() => setActiveTab("investors")}
                className="text-xs font-semibold text-[#1B3B6F] hover:text-[#142C54] flex items-center gap-1"
              >
                View all matches ({matches.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.slice(0, 3).map((m) => (
                <InvestorCard
                  key={m.id}
                  match={m}
                  onExpressInterest={(item) =>
                    alert(`Introduction request sent to ${item.investor_name} at ${item.investor_firm}!`)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. My Projects Tab */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Project Inventory</h2>
              <p className="text-xs text-[#64748B]">Toggle visibility to control investor discovery access.</p>
            </div>

            <Link
              href="/founder/projects/new"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg flex items-center gap-1.5 w-fit shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Another Project
            </Link>
          </div>

          {/* Compact Management Table */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1F5F9] text-[#64748B] uppercase font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-3">Startup Name</th>
                    <th className="px-4 py-3">Industry / Stage</th>
                    <th className="px-4 py-3">Target Raise</th>
                    <th className="px-4 py-3">Readiness Score</th>
                    <th className="px-4 py-3">Investor Visibility</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                  {projects.map((proj) => {
                    const isPublished = publishedProjects[proj.id] ?? false;
                    return (
                      <tr key={proj.id} className="hover:bg-[#FAFBFD] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold font-display text-sm text-[#0F172A]">{proj.title}</div>
                          <div className="text-[11px] text-[#64748B] line-clamp-1">{proj.tagline || proj.description}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1.5">
                            <Badge variant="secondary">{proj.industry}</Badge>
                            <Badge variant="outline">{proj.stage}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#0F172A]">
                          ${(proj.funding_required / 1000).toFixed(0)}k
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#1B3B6F] font-semibold text-xs border border-[#BFD7EE]">
                            <Sparkles className="w-3 h-3" />
                            {proj.readiness_score?.toFixed(1) || "88.0"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => togglePublish(proj.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              isPublished
                                ? "bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52]"
                                : "bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B]"
                            }`}
                          >
                            {isPublished ? (
                              <>
                                <Eye className="w-3 h-3 text-[#2E7D52]" />
                                Published
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 text-[#1B3B6F]" />
                                Private (Draft)
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => setActiveTab("readiness")}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors"
                          >
                            Report
                          </button>
                          <Link
                            href={`/founder/projects/${proj.id}`}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-[#0F1E36] hover:bg-[#0B1628] text-white transition-colors"
                          >
                            Overview
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {/* 3. AI Readiness Report Tab — Elegant Deep Navy & Pure White Visual Hierarchy */}
      {activeTab === "readiness" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary">Confidential Founder Assessment</Badge>
                <span className="text-xs text-[#64748B] font-mono">Model: Readiness Engine v2.4</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-display mt-1">
                NeuroPulse AI — Comprehensive Diagnostic Report
              </h2>
              <p className="text-xs text-[#64748B]">
                Automated multi-dimensional evaluation of pitch completeness, clinical traction, and defensibility.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-[#FAFBFD] border border-[#E2E8F0] text-[#0F172A] rounded-lg transition-colors flex items-center gap-1.5 shadow-subtle"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? "animate-spin text-[#1B3B6F]" : ""}`} />
                {reanalyzing ? "Recalculating..." : "Re-evaluate"}
              </button>
              <button
                onClick={() => alert("Diagnostic PDF Summary generated!")}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#0F1E36] hover:bg-[#0B1628] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-subtle"
              >
                <Download className="w-3.5 h-3.5" />
                Export Report
              </button>
            </div>
          </div>

          {/* Privacy Callout */}
          <div className="p-3.5 rounded-xl bg-[#EBF2FA] border border-[#BFD7EE] text-xs text-[#1B3B6F] flex items-center gap-2.5">
            <Lock className="w-4 h-4 shrink-0 text-[#1B3B6F]" />
            <span>
              <strong>Private & Confidential:</strong> This readiness score and improvement recommendations are strictly
              private to you. Investors never see weaknesses, missing regulatory milestones, or internal scores.
            </span>
          </div>

          {/* Main Assessment Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Deep Navy Circular Readiness Score Dial */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 flex flex-col justify-between shadow-subtle">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                  Composite Readiness Index
                </span>
                <h3 className="text-xl font-bold text-[#0F172A] font-display mt-1">Overall Score</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Weighted across 4 core venture pillars.
                </p>

                <div className="mt-8 text-center">
                  <div className="inline-flex items-center justify-center w-40 h-40 rounded-full border-8 border-[#1B3B6F] bg-[#EBF2FA] relative shadow-inner">
                    <div className="text-center">
                      <span className="text-5xl font-extrabold text-[#1B3B6F] font-display">92.4</span>
                      <span className="block text-[10px] text-[#64748B] uppercase font-mono mt-0.5 tracking-wider">
                        out of 100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#E2E8F0] text-xs text-[#2E7D52] flex items-center gap-1.5 justify-center bg-[#E8F5E9] py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
                <span className="font-medium">Ready for Investor Presentation</span>
              </div>
            </div>

            {/* Assessment Dimensions Breakdown */}
            <div className="lg:col-span-2 rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-6 shadow-subtle">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0F172A] font-display">Assessment Dimensions</h3>
                <span className="text-xs text-[#64748B]">Benchmark: Top 5% Seed Cohort</span>
              </div>

              <div className="space-y-4">
                {[
                  { name: "Problem / Solution Fit", score: 94, desc: "Clarity of clinical pain point and on-device machine learning defensibility" },
                  { name: "Traction & Feasibility", score: 95, desc: "Completed 2 hospital telemetry pilot trials with 99.2% arrhythmia alert accuracy" },
                  { name: "Business Model Clarity", score: 92, desc: "Hybrid sensor lease + recurring SaaS telemetry interpretation subscriptions" },
                  { name: "Market Sizing & ICP (TAM)", score: 88, desc: "$4.2B target market quantified across US telemetry cardiology units" },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#0F172A]">{item.name}</span>
                      <span className="font-mono text-[#1B3B6F] font-bold">{item.score}%</span>
                    </div>
                    <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1B3B6F] h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#64748B]">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Strengths & Improvement Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E2E8F0]">
                <div className="p-3.5 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] space-y-2">
                  <div className="text-xs font-bold text-[#2E7D52] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D52]" />
                    Key Pitch Strengths
                  </div>
                  <ul className="text-[11px] text-[#1E5236] space-y-1 list-disc list-inside">
                    <li>Proprietary on-chip quantized neural network IP</li>
                    <li>Clinical verification by Board-certified cardiologists</li>
                    <li>Clear 10x speed improvement over hospital lab loops</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE] space-y-2">
                  <div className="text-xs font-bold text-[#1B3B6F] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1B3B6F]" />
                    AI Action Recommendations
                  </div>
                  <ul className="text-[11px] text-[#18345D] space-y-1 list-disc list-inside">
                    <li>Specify FDA 510(k) pathway milestones in regulatory deck</li>
                    <li>Clarify sensor hardware bill of materials vs software margins</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Investor Discovery Tab */}
      {activeTab === "investors" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Investor Discovery Directory</h2>
              <p className="text-xs text-[#64748B]">
                Target funds and partners matched against your startup&apos;s semantic vector representation.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search investor, fund or thesis..."
                value={investorSearch}
                onChange={(e) => setInvestorSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match) => (
              <InvestorCard
                key={match.id}
                match={match}
                onExpressInterest={(item) =>
                  alert(`Introduction request submitted to ${item.investor_name} at ${item.investor_firm}!`)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* 4.5 Introduction Requests & Deal Rooms Tab */}
      {activeTab === "intros" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#1B3B6F]" />
                Introduction Requests & Deal Rooms
              </h2>
              <p className="text-xs text-[#64748B]">
                Manage inbound interest from syndicate partners. Approving an introduction unlocks your verified data room and direct messaging.
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg">
              {(["all", "pending", "accepted", "declined"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setIntroTabFilter(filter)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                    introTabFilter === filter
                      ? "bg-white text-[#0F172A] shadow-subtle border border-[#E2E8F0]"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  {filter === "all"
                    ? `All (${interests.length})`
                    : filter === "pending"
                    ? `Pending (${interests.filter((i) => i.status === "pending").length})`
                    : filter === "accepted"
                    ? `Active Rooms (${interests.filter((i) => i.status === "accepted").length})`
                    : `Declined (${interests.filter((i) => i.status === "declined").length})`}
                </button>
              ))}
            </div>
          </div>

          {interests.filter((i) => (introTabFilter === "all" ? true : i.status === introTabFilter)).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#E2E8F0] rounded-xl bg-white shadow-subtle space-y-2">
              <Briefcase className="w-8 h-8 text-[#94A3B8] mx-auto mb-1" />
              <h4 className="text-sm font-bold text-[#0F172A] font-display">No Introduction Requests in this Filter</h4>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Inbound requests from accredited investors will appear here when partners request introduction.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {interests
                .filter((i) => (introTabFilter === "all" ? true : i.status === introTabFilter))
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] transition-all space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0F1E36] border border-[#1F3354] flex items-center justify-center font-bold text-white text-sm shadow-sm font-display shrink-0">
                          {item.investor_name ? item.investor_name.slice(0, 2).toUpperCase() : "IN"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#0F172A] font-display">{item.investor_name}</h3>
                            <span className="text-xs text-[#64748B]">({item.investor_firm || "Partner Syndicate"})</span>
                          </div>
                          <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                            {item.investor_email || "verified.partner@syndicate.vc"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="primary">{item.project_title || "Project"}</Badge>
                        {item.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                        {item.status === "accepted" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52]">
                            <Unlock className="w-3 h-3" />
                            Deal Room Active
                          </span>
                        )}
                        {item.status === "declined" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B]">
                            <X className="w-3 h-3" />
                            Declined
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inbound Investor Note */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                        Investor Message & Thesis Note:
                      </span>
                      <p className="text-xs text-[#334155] leading-relaxed bg-[#F8FAFC] p-3.5 rounded-lg border border-[#F1F5F9]">
                        &quot;{item.message}&quot;
                      </p>
                    </div>

                    {/* Action Area: Pending */}
                    {item.status === "pending" && (
                      <div className="pt-2 space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                            Response Note for Partner (Optional):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Welcome Dr. Lin. Thrilled to share our ICU pilot metrics and cap table."
                            value={responseNotes[String(item.id)] || ""}
                            onChange={(e) =>
                              setResponseNotes({ ...responseNotes, [String(item.id)]: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            disabled={statusProcessing === String(item.id)}
                            onClick={() => handleUpdateStatus(item.id, "accepted")}
                            className="px-4 py-2 text-xs font-semibold text-white bg-[#2E7D52] hover:bg-[#256843] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Unlock className="w-4 h-4" />
                            {statusProcessing === String(item.id) ? "Unlocking..." : "Accept & Unlock Deal Room"}
                          </button>
                          <button
                            disabled={statusProcessing === String(item.id)}
                            onClick={() => handleUpdateStatus(item.id, "declined")}
                            className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            Decline Request
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unlocked Deal Room Access */}
                    {item.status === "accepted" && (
                      <div className="rounded-xl border border-[#C8E6C9] bg-[#F4FBF6] p-4.5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCheck className="w-4 h-4 text-[#2E7D52]" />
                            <h4 className="text-xs sm:text-sm font-bold text-[#1E5236] font-display">
                              Confidential Deal Room Active
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2E7D52] text-white">
                              Cap Table Verified
                            </span>
                          </div>
                          <span className="text-[11px] text-[#2E7D52] font-mono">Status: Connected</span>
                        </div>

                        {item.response_note && (
                          <p className="text-xs text-[#1E5236] bg-white p-2.5 rounded-lg border border-[#C8E6C9]">
                            <strong>Your Welcome Note:</strong> &quot;{item.response_note}&quot;
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <a
                            href={`https://dataroom.venturex.io/room/${item.project_id}?access=granted`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-white border border-[#C8E6C9] hover:border-[#2E7D52] rounded-lg text-xs font-medium text-[#0F172A] transition-all flex items-center justify-between shadow-subtle group"
                          >
                            <span className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#2E7D52]" />
                              Data Room & Cap Table
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2E7D52]" />
                          </a>

                          <a
                            href="https://cal.com/alexrivers/seed-intro-30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-white border border-[#C8E6C9] hover:border-[#2E7D52] rounded-lg text-xs font-medium text-[#0F172A] transition-all flex items-center justify-between shadow-subtle group"
                          >
                            <span className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#2E7D52]" />
                              Schedule Partner Call
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2E7D52]" />
                          </a>

                          <button
                            onClick={() =>
                              alert(
                                `Direct messaging channel '#channel-dealroom-${item.id}' is active! Live messaging connected.`
                              )
                            }
                            className="p-3 bg-white border border-[#C8E6C9] hover:border-[#2E7D52] rounded-lg text-xs font-medium text-[#0F172A] transition-all flex items-center justify-between shadow-subtle group"
                          >
                            <span className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-[#2E7D52]" />
                              Open Direct Chat
                            </span>
                            <span className="text-[10px] font-bold text-[#2E7D52] bg-[#E8F5E9] px-1.5 py-0.5 rounded">
                              Live
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Declined State */}
                    {item.status === "declined" && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#64748B]">This introduction request was declined.</span>
                        <button
                          disabled={statusProcessing === String(item.id)}
                          onClick={() => handleUpdateStatus(item.id, "accepted")}
                          className="text-xs font-semibold text-[#1B3B6F] hover:text-[#142C54]"
                        >
                          Reopen & Unlock Deal Room
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] font-display">Recent Activity & Notifications</h2>
              {unreadNotifCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]">
                  {unreadNotifCount} unread
                </span>
              ) : (
                <span className="text-xs text-[#64748B]">All caught up</span>
              )}
            </div>
            {unreadNotifCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3B6F] hover:text-[#0F172A] transition-colors"
              >
                <CheckCheck className="w-4 h-4 text-[#1B3B6F]" />
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-[#CBD5E1] bg-white">
              <Bell className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-[#0F172A]">No notifications yet</h3>
              <p className="text-xs text-[#64748B] mt-1">
                You will be notified when institutional investors request introductions or unlock deal rooms.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.read;
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isUnread
                      ? "border-[#BFD7EE] bg-[#F8FAFC] shadow-sm"
                      : "border-[#E2E8F0] bg-white shadow-subtle opacity-85"
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#1B3B6F] animate-pulse" />
                      )}
                      <Badge variant={(notif.badge_variant as any) || "primary"}>
                        {notif.badge}
                      </Badge>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] font-display">
                        {notif.title}
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-[#94A3B8] shrink-0">
                      {notif.time || "Recently"}
                    </span>
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed pl-0.5">
                    {notif.desc}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9] text-xs">
                    {notif.link ? (
                      <Link
                        href={notif.link}
                        className="font-semibold text-[#1B3B6F] hover:text-[#0F172A] inline-flex items-center gap-1"
                      >
                        View Activity →
                      </Link>
                    ) : (
                      <span />
                    )}

                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-[11px] text-[#64748B] hover:text-[#0F172A] font-medium"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 6. Profile Tab */}
      {activeTab === "profile" && (
        <div className="max-w-2xl mx-auto rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-subtle">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Founder Profile</h2>
              <p className="text-xs text-[#64748B]">Founder credentials presented to interested investors.</p>
            </div>
            <Badge variant="success">Verified Founder</Badge>
          </div>

          {saveSuccess && (
            <div className="mb-6 p-3 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
              Profile updated successfully.
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Full Name</label>
              <input
                type="text"
                value={founderProfile.name}
                onChange={(e) => setFounderProfile({ ...founderProfile, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Primary Company Name</label>
              <input
                type="text"
                value={founderProfile.company}
                onChange={(e) => setFounderProfile({ ...founderProfile, company: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Founder Bio / Background</label>
              <textarea
                rows={3}
                value={founderProfile.bio}
                onChange={(e) => setFounderProfile({ ...founderProfile, bio: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Location</label>
                <input
                  type="text"
                  value={founderProfile.location}
                  onChange={(e) => setFounderProfile({ ...founderProfile, location: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">LinkedIn Profile</label>
                <input
                  type="url"
                  value={founderProfile.linkedin}
                  onChange={(e) => setFounderProfile({ ...founderProfile, linkedin: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Company Website</label>
              <input
                type="url"
                value={founderProfile.website}
                onChange={(e) => setFounderProfile({ ...founderProfile, website: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Settings Tab */}
      {activeTab === "settings" && (
        <div className="max-w-2xl mx-auto rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-subtle">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Workspace & Privacy Settings</h2>
              <p className="text-xs text-[#64748B]">Configure confidentiality defaults and alert preferences.</p>
            </div>
            <Lock className="w-5 h-5 text-[#1B3B6F]" />
          </div>

          {settingsSuccess && (
            <div className="mb-6 p-3 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
              Settings updated successfully.
            </div>
          )}

          <form onSubmit={handleSettingsSave} className="space-y-6 text-xs sm:text-sm">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-display">
                Critical Privacy Controls
              </h3>

              <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-[#FAFBFD] border border-[#E2E8F0]">
                <div>
                  <div className="font-semibold text-[#0F172A]">Private by Default</div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    New projects created remain hidden from investors until explicitly marked Published.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.defaultPrivate}
                  onChange={(e) => setSettings({ ...settings, defaultPrivate: e.target.checked })}
                  className="mt-1 accent-[#1B3B6F] w-4 h-4"
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE]">
                <div>
                  <div className="font-semibold text-[#1B3B6F] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Confidential AI Readiness Rule
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    Never expose private readiness scores, missing information, or weakness diagnostics to investors.
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={settings.hideGapsFromInvestors}
                  className="mt-1 accent-[#1B3B6F] w-4 h-4 cursor-not-allowed opacity-80"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-display">
                Alert Preferences
              </h3>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-[#0F172A]">Email Notifications for High-Score Matches (&gt;90%)</div>
                  <div className="text-xs text-[#64748B]">Get notified when an investor mandate matches your startup.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
                  className="accent-[#1B3B6F] w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-[#0F172A]">Weekly Dealflow Digest</div>
                  <div className="text-xs text-[#64748B]">Summary of interested investor funds.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.weeklyDigest}
                  onChange={(e) => setSettings({ ...settings, weeklyDigest: e.target.checked })}
                  className="accent-[#1B3B6F] w-4 h-4"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm"
              >
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
}

export default function FounderDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#64748B]">Loading Founder Workspace...</div>}>
      <FounderDashboardContent />
    </Suspense>
  );
}
