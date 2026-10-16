"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  Rocket,
  Sparkles,
  Layers,
  Search,
  Filter,
  Heart,
  User,
  Sliders,
  CheckCircle2,
  Building2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Bell,
  Settings,
  ArrowUpRight,
  UserCheck,
  Clock,
  Unlock,
  Lock,
  ExternalLink,
  Calendar,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  CheckCheck,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProjectCard } from "@/components/ProjectCard";
import { StatCard } from "@/components/StatCard";
import { PortalLayout } from "@/components/PortalLayout";
import { api, MOCK_PROJECTS, MOCK_MATCHES } from "@/lib/api";
import { Project, MatchItem, ProjectInterest, NotificationItem } from "@/types";

function InvestorDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = useSearchParams().get("tab");

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [matches, setMatches] = useState<MatchItem[]>(MOCK_MATCHES);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savedInterests, setSavedInterests] = useState<number[]>([1]);
  const [interestsList, setInterestsList] = useState<ProjectInterest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);


  const [investorProfile, setInvestorProfile] = useState({
    name: "Dr. Sarah Lin",
    firm: "Apex Horizon Ventures",
    title: "General Partner",
    bio: "Investing in Healthcare AI, MedTech diagnostics, and clinical automation infrastructure.",
    location: "New York & Boston",
    thesis: "Leading Seed and Series A rounds for high-defensibility technical founders solving critical clinical bottleneck problems.",
    minCheck: "$500,000",
    maxCheck: "$1,500,000",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [settings, setSettings] = useState({
    autoNotifyHighConviction: true,
    weeklyDealflowSummary: true,
    directFounderMessaging: true,
  });

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    let mounted = true;
    api.getProjects().then((data) => {
      if (mounted && data.length > 0) setProjects(data);
    });
    api.getMatches().then((data) => {
      if (mounted && data.length > 0) setMatches(data);
    });
    api.getInvestorProfile().then((data) => {
      if (mounted && data) {
        setInvestorProfile((prev) => ({
          ...prev,
          name: data.name || prev.name,
          firm: data.firm || prev.firm,
          title: data.title || prev.title,
          bio: data.bio || prev.bio,
          location: data.location || prev.location,
          thesis: data.thesis || prev.thesis,
          minCheck: data.min_check || prev.minCheck,
          maxCheck: data.max_check || prev.maxCheck,
        }));
      }
    });
    api.getInvestorSettings().then((data) => {
      if (mounted && data) {
        setSettings({
          autoNotifyHighConviction: data.auto_notify_high_conviction ?? true,
          weeklyDealflowSummary: data.weekly_dealflow_summary ?? true,
          directFounderMessaging: data.direct_founder_messaging ?? true,
        });
      }
    });
    api.getInterests().then((data) => {
      if (mounted && Array.isArray(data) && data.length > 0) {
        setSavedInterests(data.map((item: any) => Number(item.project_id)));
        setInterestsList(data);
      }
    });
    api.getNotifications("INVESTOR").then((data) => {
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
    await api.markAllNotificationsRead("INVESTOR");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifCount(0);
  };


  const toggleInterest = async (projectId: number) => {
    if (savedInterests.includes(projectId)) {
      setSavedInterests(savedInterests.filter((id) => id !== projectId));
      setInterestsList(interestsList.filter((item) => Number(item.project_id) !== Number(projectId)));
    } else {
      setSavedInterests([...savedInterests, projectId]);
      const created = await api.expressInterest({ project_id: projectId });
      if (created) {
        setInterestsList((prev) => [created, ...prev]);
      }
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesIndustry =
      selectedIndustry === "All" || p.industry.toLowerCase().includes(selectedIndustry.toLowerCase());
    const matchesSearch =
      searchQuery === "" ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.industry.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesIndustry && matchesSearch;
  });

  const interestedProjectsList = projects.filter((p) => savedInterests.includes(p.id));

  return (
    <PortalLayout
      role="INVESTOR"
      activeItem={activeTab}
      onSelectItem={(tab) => setActiveTab(tab)}
      title={
        activeTab === "overview"
          ? "Dealflow Overview"
          : activeTab === "recommended"
          ? "Recommended Projects"
          : activeTab === "browse"
          ? "Browse Startups"
          : activeTab === "interests"
          ? `My Interests (${savedInterests.length})`
          : activeTab === "notifications"
          ? "Notifications"
          : activeTab === "profile"
          ? "Investor Profile"
          : "Settings"
      }
    >
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-8 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success">Investor Portal</Badge>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D52]" /> Verified Dealflow
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
            {activeTab === "overview" && "Investor Dealflow"}
            {activeTab === "recommended" && "Thesis-Matched Recommendations"}
            {activeTab === "browse" && "Explore Startup Pipeline"}
            {activeTab === "interests" && "Expressed Founder Introductions"}
            {activeTab === "notifications" && "Investor Notifications"}
            {activeTab === "profile" && "Fund & Partner Profile"}
            {activeTab === "settings" && "Dealflow & Notification Preferences"}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            {activeTab === "overview" && "Discover vetted early-stage startups matched against your fund mandate."}
            {activeTab === "recommended" && "Curated deals ranked by high-dimensional vector similarity and check size criteria."}
            {activeTab === "browse" && "Filter founder-approved ventures across sectors, stages, and business models."}
            {activeTab === "interests" && "Startups you have flagged for introduction requests and data room access."}
            {activeTab === "notifications" && "Alerts for new founder submissions matching your thesis filters."}
            {activeTab === "profile" && "Firm identity and investment thesis visible to matched founders."}
            {activeTab === "settings" && "Configure dealflow alerts and direct founder contact thresholds."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/investor/preferences"
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-all shadow-sm flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 text-[#93C5FD]" />
            Edit Investment Criteria
          </Link>
        </div>
      </div>

      {/* 1. Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Top Stat Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Recommended Deals"
              value={matches.length}
              change="90%+ fit score"
              icon={Sparkles}
              subtext="Matched by AI thesis"
            />
            <StatCard
              label="Pipeline Startups"
              value={projects.length}
              change="3 new this week"
              icon={Rocket}
              subtext="Active founder pitches"
            />
            <StatCard
              label="Expressed Interests"
              value={savedInterests.length}
              change="Intros Active"
              icon={Heart}
              subtext="Direct founder dialog"
            />
            <StatCard
              label="Target Allocation"
              value="$500K - $1.5M"
              change="Seed Mandate"
              icon={DollarSign}
              subtext="Apex Horizon Fund II"
            />
          </div>

          {/* Current Mandate Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-subtle">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">
                Active Fund Target Criteria
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] font-display">
                Healthcare AI, DeepTech & Enterprise SaaS ($500K - $1.5M Seed)
              </h3>
              <p className="text-xs text-[#64748B] max-w-xl leading-relaxed">
                Startups are filtered automatically against your minimum check size of $500,000 and Seed stage threshold.
                Founder privacy is strictly preserved.
              </p>
            </div>
            <Link
              href="/investor/preferences"
              className="px-4 py-2 text-xs font-medium text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors whitespace-nowrap shadow-subtle"
            >
              Adjust Match Preferences
            </Link>
          </div>

          {/* High-Conviction Matches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] font-display flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1B3B6F]" />
                  High-Conviction Thesis Matches
                </h2>
                <p className="text-xs text-[#64748B]">Founder-approved profiles verified for your fund criteria.</p>
              </div>
              <button
                onClick={() => setActiveTab("recommended")}
                className="text-xs font-semibold text-[#1B3B6F] hover:text-[#142C54]"
              >
                View all ({matches.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 3).map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  isInvestorView={true}
                  onConnect={() => toggleInterest(p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Recommended Projects Tab */}
      {activeTab === "recommended" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] font-display">Semantic Vector Recommendations</h2>
            <p className="text-xs text-[#64748B]">
              Ranked by vector cosine similarity against your investment mandate. Private founder scores are omitted per privacy protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isInvestorView={true}
                onConnect={() => toggleInterest(project.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Browse Projects Tab */}
      {activeTab === "browse" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Industry Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#64748B] mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Sector:
              </span>
              {["All", "Healthcare", "ClimateTech", "Cybersecurity", "Fintech"].map((ind) => (
                <button
                  key={ind}
                  onClick={() => setSelectedIndustry(ind)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedIndustry === ind
                      ? "bg-[#1B3B6F] text-white shadow-sm"
                      : "bg-white text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search startups or tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isInvestorView={true}
                onConnect={() => toggleInterest(project.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. My Interests Tab */}
      {activeTab === "interests" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] font-display flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#1B3B6F]" />
                Deal Rooms & Expressed Introductions
              </h2>
              <p className="text-xs text-[#64748B]">
                Track introduction requests to founders. Once approved by the founding team, their confidential data room, direct messaging channel, and meeting scheduler unlock below.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("browse")}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-colors shadow-sm self-start sm:self-auto"
            >
              Browse More Startups
            </button>
          </div>

          {interestsList.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#E2E8F0] rounded-xl bg-white shadow-subtle space-y-2">
              <Heart className="w-8 h-8 text-[#94A3B8] mx-auto mb-1" />
              <h4 className="text-sm font-bold text-[#0F172A] font-display">No Expressed Interests Yet</h4>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Browse our dealflow catalog and click &quot;Request Introduction&quot; to initiate a confidential deal room dialogue.
              </p>
              <button
                onClick={() => setActiveTab("browse")}
                className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg shadow-sm"
              >
                Explore Dealflow Pipeline
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {interestsList.map((interest) => {
                const project = projects.find((p) => Number(p.id) === Number(interest.project_id));
                const title = interest.project_title || project?.title || `Project #${interest.project_id}`;
                const industry = interest.project_industry || project?.industry || "Technology";
                const isAccepted = interest.status === "accepted";
                const isPending = interest.status === "pending";

                return (
                  <div
                    key={interest.id}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] transition-all space-y-4"
                  >
                    {/* Header with Title & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-bold text-[#0F172A] font-display">{title}</h3>
                          <Badge variant="primary">{industry}</Badge>
                          {project && <Badge variant="secondary">{project.stage}</Badge>}
                        </div>
                        {project && (
                          <p className="text-xs text-[#64748B] mt-1 line-clamp-1">{project.tagline || project.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]">
                            <Clock className="w-3.5 h-3.5" />
                            Pending Founder Review
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52]">
                            <Unlock className="w-3.5 h-3.5" />
                            Deal Room Unlocked
                          </span>
                        )}
                        {interest.status === "declined" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B]">
                            <Lock className="w-3.5 h-3.5" />
                            Declined by Founder
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Introductory message */}
                    {interest.message && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                          Your Introduction Message:
                        </span>
                        <p className="text-xs text-[#475569] italic bg-[#F8FAFC] p-3 rounded-lg border border-[#F1F5F9]">
                          &quot;{interest.message}&quot;
                        </p>
                      </div>
                    )}

                    {/* Pending State Banner */}
                    {isPending && (
                      <div className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#D97706] shrink-0" />
                          Founder is reviewing your firm&apos;s thesis note. Once accepted, confidential data room materials unlock here.
                        </span>
                        <button
                          onClick={() => toggleInterest(Number(interest.project_id))}
                          className="text-[11px] font-semibold text-[#92400E] hover:underline shrink-0 ml-2"
                        >
                          Withdraw Request
                        </button>
                      </div>
                    )}

                    {/* Unlocked Deal Room Panel */}
                    {isAccepted && (
                      <div className="rounded-xl border border-[#C8E6C9] bg-[#F4FBF6] p-4.5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCheck className="w-4 h-4 text-[#2E7D52]" />
                            <h4 className="text-xs sm:text-sm font-bold text-[#1E5236] font-display">
                              Confidential Deal Room Unlocked
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2E7D52] text-white">
                              Cap Table Verified
                            </span>
                          </div>
                          <span className="text-xs text-[#2E7D52] font-semibold flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {interest.founder_email || "founder@venturex.demo"}
                          </span>
                        </div>

                        {interest.response_note && (
                          <p className="text-xs text-[#1E5236] bg-white p-2.5 rounded-lg border border-[#C8E6C9]">
                            <strong>Founder Note:</strong> &quot;{interest.response_note}&quot;
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <a
                            href={`https://dataroom.venturex.io/room/${interest.project_id}?access=granted`}
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
                                `Direct messaging channel '#channel-dealroom-${interest.id}' is active! Live messaging connected.`
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] font-display">Investor Notifications</h2>
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
                You will be notified when founders approve your deal room requests or new high-fit startups match your mandate.
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
                        Open Target View →
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
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Investor Profile</h2>
              <p className="text-xs text-[#64748B]">Firm parameters and fund thesis displayed to matched founders.</p>
            </div>
            <Badge variant="success">Accredited Partner</Badge>
          </div>

          {profileSaved && (
            <div className="mb-6 p-3 rounded-lg bg-[#E8F5E9] border border-[#A3E635] text-[#2E7D52] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
              Investor profile saved successfully.
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api.updateInvestorProfile({
                name: investorProfile.name,
                firm: investorProfile.firm,
                title: investorProfile.title,
                bio: investorProfile.bio,
                location: investorProfile.location,
                thesis: investorProfile.thesis,
                min_check: investorProfile.minCheck,
                max_check: investorProfile.maxCheck,
              });
              setProfileSaved(true);
              setTimeout(() => setProfileSaved(false), 3000);
            }}
            className="space-y-4 text-xs sm:text-sm"
          >
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Partner Full Name</label>
              <input
                type="text"
                value={investorProfile.name}
                onChange={(e) => setInvestorProfile({ ...investorProfile, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Firm / Fund Name</label>
                <input
                  type="text"
                  value={investorProfile.firm}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, firm: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Partner Title</label>
                <input
                  type="text"
                  value={investorProfile.title}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Fund Investment Thesis</label>
              <textarea
                rows={3}
                value={investorProfile.thesis}
                onChange={(e) => setInvestorProfile({ ...investorProfile, thesis: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Minimum Check Size</label>
                <input
                  type="text"
                  value={investorProfile.minCheck}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, minCheck: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Maximum Check Size</label>
                <input
                  type="text"
                  value={investorProfile.maxCheck}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, maxCheck: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm"
              >
                Save Investor Profile
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
              <h2 className="text-lg font-bold text-[#0F172A] font-display">Dealflow Settings</h2>
              <p className="text-xs text-[#64748B]">Configure notifications and screening preferences.</p>
            </div>
            <Settings className="w-5 h-5 text-[#64748B]" />
          </div>

          {settingsSaved && (
            <div className="mb-6 p-3 rounded-lg bg-[#E8F5E9] border border-[#A3E635] text-[#2E7D52] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
              Preferences updated successfully.
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api.updateInvestorSettings({
                auto_notify_high_conviction: settings.autoNotifyHighConviction,
                weekly_dealflow_summary: settings.weeklyDealflowSummary,
                direct_founder_messaging: settings.directFounderMessaging,
              });
              setSettingsSaved(true);
              setTimeout(() => setSettingsSaved(false), 3000);
            }}
            className="space-y-4 text-xs sm:text-sm"
          >
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <div className="font-semibold text-[#0F172A]">Real-time Notifications for &gt;90% Matches</div>
                <div className="text-xs text-[#64748B] mt-0.5">
                  Instant notification when a founder approves dealflow that fits your sector thesis.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoNotifyHighConviction}
                onChange={(e) => setSettings({ ...settings, autoNotifyHighConviction: e.target.checked })}
                className="mt-1 accent-[#1B3B6F] w-4 h-4"
              />
            </div>

            <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <div className="font-semibold text-[#0F172A]">Weekly Curated Dealflow Digest</div>
                <div className="text-xs text-[#64748B] mt-0.5">
                  Summary email delivered every Monday morning with highest conviction startups.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.weeklyDealflowSummary}
                onChange={(e) => setSettings({ ...settings, weeklyDealflowSummary: e.target.checked })}
                className="mt-1 accent-[#1B3B6F] w-4 h-4"
              />
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
}

export default function InvestorDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#64748B]">Loading Investor Portal...</div>}>
      <InvestorDashboardContent />
    </Suspense>
  );
}
