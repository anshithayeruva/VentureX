"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProjectCard } from "@/components/ProjectCard";
import { StatCard } from "@/components/StatCard";
import { api, MOCK_PROJECTS, MOCK_MATCHES } from "@/lib/api";
import { Project, MatchItem } from "@/types";

export default function InvestorDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "recommended" | "browse" | "interests" | "profile">("overview");
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [matches, setMatches] = useState<MatchItem[]>(MOCK_MATCHES);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("All");
  const [savedInterests, setSavedInterests] = useState<number[]>([1]);
  const [investorProfile, setInvestorProfile] = useState({
    name: "Dr. Sarah Lin",
    firm: "Apex Horizon Ventures",
    title: "General Partner",
    bio: "Investing in Healthcare AI, MedTech hardware, and frontier enterprise automation.",
    location: "New York & Boston",
    thesis: "We lead Seed and Series A rounds for high-defensibility technical founders solving critical clinical bottleneck problems.",
    minCheck: "$500,000",
    maxCheck: "$1,500,000",
  });
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getProjects().then((data) => {
      if (mounted && data.length > 0) setProjects(data);
    });
    api.getMatches().then((data) => {
      if (mounted && data.length > 0) setMatches(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleInterest = (projectId: number) => {
    if (savedInterests.includes(projectId)) {
      setSavedInterests(savedInterests.filter((id) => id !== projectId));
    } else {
      setSavedInterests([...savedInterests, projectId]);
    }
  };

  const filteredProjects = selectedIndustry === "All"
    ? projects
    : projects.filter((p) => p.industry.toLowerCase().includes(selectedIndustry.toLowerCase()));

  const interestedProjectsList = projects.filter((p) => savedInterests.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="success">Investor Portal</Badge>
            <span className="text-xs text-zinc-500 font-mono">Role: INVESTOR</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
            Investor Dealflow
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Discover vetted early-stage startups scored and matched against your fund mandate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/investor/preferences"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <Sliders className="w-4 h-4" />
            Edit Investment Criteria
          </Link>
        </div>
      </div>

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <StatCard
          label="Recommended Startups"
          value={matches.length}
          change="90%+ fit score"
          icon={Sparkles}
          subtext="Matched by AI thesis"
        />
        <StatCard
          label="Dealflow Pipeline"
          value={projects.length}
          change="3 new this week"
          icon={Rocket}
          subtext="In active screening"
        />
        <StatCard
          label="Expressed Interests"
          value={savedInterests.length}
          change="Intro in progress"
          icon={Heart}
          subtext="Direct founder dialog"
        />
        <StatCard
          label="Target Allocation"
          value="$500K - $1.5M"
          change="Seed / Post-Seed"
          icon={DollarSign}
          subtext="Apex Horizon Fund II"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="mt-10 border-b border-zinc-800">
        <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-px">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "recommended", label: "Recommended Projects", icon: Sparkles },
            { id: "browse", label: "Browse Projects", icon: Search },
            { id: "interests", label: `My Interests (${savedInterests.length})`, icon: Heart },
            { id: "profile", label: "Investor Profile", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="mt-8 space-y-10">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                High-Conviction Matches For Your Thesis
              </h2>
              <button
                onClick={() => setActiveTab("recommended")}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                View all ({matches.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 3).map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onConnect={() => toggleInterest(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Criteria Overview Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs uppercase font-mono text-zinc-400">Current Target Criteria</span>
              <h3 className="text-lg font-bold text-white">Healthcare AI, DeepTech & B2B SaaS</h3>
              <p className="text-xs text-zinc-400 max-w-xl">
                Startups are filtered automatically against your minimum check size of $500,000 and Seed stage threshold.
              </p>
            </div>
            <Link
              href="/investor/preferences"
              className="px-4 py-2 text-xs font-semibold text-emerald-400 hover:text-white bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-600 rounded-lg transition-colors whitespace-nowrap"
            >
              Adjust Match Preferences
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: Recommended Projects */}
      {activeTab === "recommended" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">AI-Recommended Projects</h2>
            <p className="text-xs text-zinc-400">
              Ranked by vector cosine similarity and thesis constraints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onConnect={() => toggleInterest(project.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Browse Projects */}
      {activeTab === "browse" && (
        <div className="mt-8 space-y-6">
          {/* Industry Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <span className="text-xs font-semibold text-zinc-400 mr-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Industry:
            </span>
            {["All", "Healthcare", "ClimateTech", "Cybersecurity", "Fintech"].map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedIndustry === ind
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onConnect={() => toggleInterest(project.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: My Interests */}
      {activeTab === "interests" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Expressed Founder Introductions</h2>
            <p className="text-xs text-zinc-400">
              Projects you have marked for direct connection and deal room access.
            </p>
          </div>

          {interestedProjectsList.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
              <Heart className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">You haven&apos;t expressed interest in any startups yet.</p>
              <button
                onClick={() => setActiveTab("browse")}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500"
              >
                Browse Startups
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {interestedProjectsList.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onConnect={() => toggleInterest(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Profile */}
      {activeTab === "profile" && (
        <div className="mt-8 max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Investor Profile</h2>
              <p className="text-xs text-zinc-400">Firm details and investment mandate shown to founders.</p>
            </div>
            <Badge variant="success">Accredited Investor</Badge>
          </div>

          {profileSaved && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Investor profile updated successfully.
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setProfileSaved(true);
              setTimeout(() => setProfileSaved(false), 3000);
            }}
            className="space-y-4 text-sm"
          >
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                value={investorProfile.name}
                onChange={(e) => setInvestorProfile({ ...investorProfile, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Firm / Syndicate Name</label>
                <input
                  type="text"
                  value={investorProfile.firm}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, firm: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  value={investorProfile.title}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Investment Thesis</label>
              <textarea
                rows={3}
                value={investorProfile.thesis}
                onChange={(e) => setInvestorProfile({ ...investorProfile, thesis: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Minimum Check Size</label>
                <input
                  type="text"
                  value={investorProfile.minCheck}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, minCheck: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Maximum Check Size</label>
                <input
                  type="text"
                  value={investorProfile.maxCheck}
                  onChange={(e) => setInvestorProfile({ ...investorProfile, maxCheck: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-md"
              >
                Save Investor Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
