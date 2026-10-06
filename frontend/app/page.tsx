"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Rocket,
  Briefcase,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Database,
  Layers,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProjectCard } from "@/components/ProjectCard";
import { StatCard } from "@/components/StatCard";
import { api, MOCK_PROJECTS } from "@/lib/api";
import { Project } from "@/types";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [apiHealth, setApiHealth] = useState<{ status: string; service?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    api.checkHealth().then((health) => {
      if (mounted) setApiHealth(health);
    });
    api.getProjects().then((data) => {
      if (mounted && data.length > 0) setProjects(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-cyan-500/10 blur-[130px] -z-10" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-xs text-zinc-300 mb-8 backdrop-blur-sm shadow-inner">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white">Venture X Platform</span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">AI-Powered Founder & Investor Matching</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Where Ambitious Startups Meet{" "}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Their Ideal Investors.
          </span>
        </h1>

        {/* Short Description */}
        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Stop pitching into the void. Venture X analyzes startup readiness, synthesizes investor
          theses, and drives high-conviction introductions powered by semantic intelligence.
        </p>

        {/* Primary Call-to-Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/founder/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 group"
          >
            <Rocket className="w-5 h-5 text-cyan-300 group-hover:-translate-y-0.5 transition-transform" />
            I&apos;m a Founder
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/investor/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-600 shadow-md transition-all flex items-center justify-center gap-2 group"
          >
            <Briefcase className="w-5 h-5 text-emerald-400 group-hover:-translate-y-0.5 transition-transform" />
            I&apos;m an Investor
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Auth Secondary Buttons */}
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-zinc-400">
          <span>Already have an account?</span>
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4">
            Sign In
          </Link>
          <span>•</span>
          <Link href="/register" className="text-zinc-300 hover:text-white font-medium">
            Create Free Account
          </Link>
        </div>

        {/* Backend Connectivity Status Box */}
        <div className="mt-12 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>API Backend:</span>
          <span className="text-zinc-200 font-semibold">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span>
          <span className="text-zinc-600">|</span>
          <span className={apiHealth?.status === "healthy" ? "text-emerald-400" : "text-amber-400"}>
            {apiHealth?.status === "healthy" ? "Healthy (Live Connection)" : "Standby (Offline Fallback)"}
          </span>
        </div>
      </section>

      {/* KPI Metrics Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Projects Evaluated"
            value="340+"
            change="+18% this month"
            icon={Rocket}
            subtext="Pre-seed to Series A startups"
          />
          <StatCard
            label="Verified Investors"
            value="185"
            change="Active Mandates"
            icon={Briefcase}
            subtext="Angels, VCs & Syndicates"
          />
          <StatCard
            label="Average Match Accuracy"
            value="94.2%"
            change="Explainable AI"
            icon={Sparkles}
            subtext="Based on thesis & stage alignment"
          />
          <StatCard
            label="Target Raise Facilitated"
            value="$48M"
            change="Combined Pipeline"
            icon={TrendingUp}
            subtext="Across DeepTech, SaaS & Bio"
          />
        </div>
      </section>

      {/* Core Concept / Workflow Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="indigo" size="md">Core Architecture Concept</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 tracking-tight">
            How Venture X Bridges the Gap
          </h2>
          <p className="text-zinc-400 mt-2 text-base">
            From pitch submission to verified dealflow, every step is built for future automated semantic intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-4">
              01
            </div>
            <h3 className="text-lg font-bold text-white">1. Founder Uploads Project</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Founders document problem, solution, market size, business model, and stage.
              The AI Readiness Engine prepares to score project completeness.
            </p>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500 font-mono">
              → Readiness Analysis & Gap Detection
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-blue-500/30 bg-zinc-900/70 p-6 relative shadow-lg shadow-blue-500/5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm mb-4">
              02
            </div>
            <h3 className="text-lg font-bold text-white">2. Semantic Vector Synthesis</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Investor criteria (industries, check size, stage, geography) are indexed alongside startup embeddings
              for high-dimensional similarity computation.
            </p>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-cyan-400 font-mono">
              → Sentence Transformers & pgvector
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-4">
              03
            </div>
            <h3 className="text-lg font-bold text-white">3. Explainable Match & Connect</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Both parties receive explainable rationale: why this project fits the investor&apos;s mandate,
              and why this partner accelerates the founder&apos;s growth.
            </p>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500 font-mono">
              → High-Conviction Connection
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="primary">Active Pipeline</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              Featured Startup Projects
            </h2>
            <p className="text-sm text-zinc-400">
              Live projects currently showcased to registered investors.
            </p>
          </div>
          <Link
            href="/founder/projects/new"
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Rocket className="w-4 h-4" />
            Submit Your Startup
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {/* Call to Action Footer Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-10 sm:p-16 relative overflow-hidden">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to accelerate your venture?
            </h2>
            <p className="mt-4 text-zinc-400 text-base leading-relaxed">
              Join founders raising faster with AI-augmented pitch readiness and direct investor discovery.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/founder/projects/new"
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
              >
                Create Startup Profile
              </Link>
              <Link
                href="/investor/preferences"
                className="px-6 py-3 rounded-xl text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-all"
              >
                Configure Investor Filters
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
