"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProjectCard } from "@/components/ProjectCard";
import { InvestorCard } from "@/components/InvestorCard";
import { StatCard } from "@/components/StatCard";
import { api, MOCK_PROJECTS, MOCK_MATCHES } from "@/lib/api";
import { Project, MatchItem } from "@/types";

export default function FounderDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "investors" | "readiness" | "profile">("overview");
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [matches, setMatches] = useState<MatchItem[]>(MOCK_MATCHES);
  const [founderProfile, setFounderProfile] = useState({
    name: "Alex Rivers",
    company: "NeuroPulse AI",
    bio: "Founding engineer & biomedical researcher building edge diagnostic hardware.",
    location: "San Francisco, CA",
    linkedin: "https://linkedin.com/in/alexrivers",
    website: "https://neuropulse.demo",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getProjects(true).then((data) => {
      if (mounted && data.length > 0) setProjects(data);
    });
    api.getMatches().then((data) => {
      if (mounted && data.length > 0) setMatches(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="indigo">Founder Workspace</Badge>
            <span className="text-xs text-zinc-500 font-mono">Role: FOUNDER</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
            Founder Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Track pitch deck readiness, manage startup profiles, and review explainable investor matches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/founder/projects/new"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Submit New Project
          </Link>
        </div>
      </div>

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <StatCard
          label="Active Projects"
          value={projects.length}
          change="+1 this quarter"
          icon={Rocket}
          subtext="Under investor review"
        />
        <StatCard
          label="AI Readiness Average"
          value="90.5%"
          change="High Conviction"
          icon={Sparkles}
          subtext="Model: Gap Analysis v1"
        />
        <StatCard
          label="Matched Investors"
          value={matches.length}
          change="3 new theses"
          icon={Users}
          subtext="Exceeds 85% match threshold"
        />
        <StatCard
          label="Intro Requests"
          value="2"
          change="Pending Response"
          icon={TrendingUp}
          subtext="Syndicate partners"
        />
      </div>

      {/* Tabs Navigation */}
      <div className="mt-10 border-b border-zinc-800">
        <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-px">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "projects", label: "My Projects", icon: Rocket },
            { id: "investors", label: "Recommended Investors", icon: Users },
            { id: "readiness", label: "Project Readiness", icon: Sparkles },
            { id: "profile", label: "Founder Profile", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-400"
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
              <h2 className="text-xl font-bold text-white">Your Showcase Projects</h2>
              <button
                onClick={() => setActiveTab("projects")}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
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

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Top Recommended Investors</h2>
              <button
                onClick={() => setActiveTab("investors")}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                View all matches ({matches.length}) →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.slice(0, 3).map((m) => (
                <InvestorCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: My Projects */}
      {activeTab === "projects" && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Submitted Projects</h2>
              <p className="text-xs text-zinc-400">All startups published under your founder account.</p>
            </div>
            <Link
              href="/founder/projects/new"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Add Project
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Recommended Investors */}
      {activeTab === "investors" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Semantic AI Matches</h2>
            <p className="text-xs text-zinc-400">
              Investors whose investment preferences and past deal history match your project criteria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
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

      {/* Tab 4: Project Readiness */}
      {activeTab === "readiness" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">AI Project Readiness Scoring</h2>
            <p className="text-xs text-zinc-400">
              Automated evaluation of project maturity, market clarity, and traction signals.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Score Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col justify-between">
              <div>
                <Badge variant="indigo">Composite Metric</Badge>
                <h3 className="text-2xl font-bold text-white mt-3">Readiness Score</h3>
                <p className="text-xs text-zinc-400 mt-1">Based on pitch completeness and industry validation.</p>
                
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center justify-center w-36 h-36 rounded-full border-4 border-cyan-400/40 bg-zinc-950/60 relative">
                    <div className="text-center">
                      <span className="text-4xl font-extrabold text-white">92.4</span>
                      <span className="block text-[11px] text-zinc-500 uppercase font-mono">out of 100</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-800 text-xs text-emerald-400 flex items-center gap-1.5 justify-center">
                <CheckCircle2 className="w-4 h-4" />
                Ready for Investor Presentation
              </div>
            </div>

            {/* Metric Breakdown */}
            <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
              <h3 className="text-lg font-bold text-white">Evaluation Breakdown</h3>
              
              <div className="space-y-4">
                {[
                  { name: "Problem / Solution Fit", score: 94, desc: "Clarity of pain point and defensibility of solution" },
                  { name: "Business Model Clarity", score: 92, desc: "Pricing model, margins, and customer monetization paths" },
                  { name: "Market Sizing (TAM/SAM)", score: 88, desc: "Quantified market opportunity and realistic growth projections" },
                  { name: "Traction & Feasibility", score: 95, desc: "Early pilot results, clinical data, and team engineering capability" },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{item.name}</span>
                      <span className="font-mono text-cyan-400 font-bold">{item.score}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${item.score}%` }} />
                    </div>
                    <p className="text-[11px] text-zinc-500">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* AI Feedback Recommendations */}
              <div className="mt-6 pt-4 border-t border-zinc-800 rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/80">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold mb-2">
                  <Sparkles className="w-4 h-4" />
                  AI Synthesis & Recommended Polish Points
                </div>
                <ul className="space-y-2 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Include explicit FDA 510(k) pathway milestones in regulatory section.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>State unit economics (bill of materials vs. subscription software margin).</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Profile */}
      {activeTab === "profile" && (
        <div className="mt-8 max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Founder Profile</h2>
              <p className="text-xs text-zinc-400">Personal and company identity shown to interested investors.</p>
            </div>
            <Badge variant="indigo">Verified Founder</Badge>
          </div>

          {saveSuccess && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Profile updated successfully.
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                value={founderProfile.name}
                onChange={(e) => setFounderProfile({ ...founderProfile, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Primary Company Name</label>
              <input
                type="text"
                value={founderProfile.company}
                onChange={(e) => setFounderProfile({ ...founderProfile, company: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Bio / Founder Background</label>
              <textarea
                rows={3}
                value={founderProfile.bio}
                onChange={(e) => setFounderProfile({ ...founderProfile, bio: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Location</label>
                <input
                  type="text"
                  value={founderProfile.location}
                  onChange={(e) => setFounderProfile({ ...founderProfile, location: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={founderProfile.linkedin}
                  onChange={(e) => setFounderProfile({ ...founderProfile, linkedin: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Company Website</label>
              <input
                type="url"
                value={founderProfile.website}
                onChange={(e) => setFounderProfile({ ...founderProfile, website: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-md"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
