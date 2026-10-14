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
  Lock,
  ArrowUpRight,
  Users,
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
    <div className="relative bg-[#F8FAFC] overflow-hidden">
      {/* Hero Section — Elegant Deep Navy & White Editorial Composition */}
      <section className="relative pt-16 pb-14 md:pt-24 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Top Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#0F172A] mb-6 shadow-subtle">
            <span className="flex h-2 w-2 rounded-full bg-[#1B3B6F]" />
            <span className="font-semibold text-[#0F172A]">Venture X Platform</span>
            <span className="text-[#94A3B8]">|</span>
            <span className="text-[#64748B]">AI-Powered Founder & Investor Matching</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0F172A] font-display max-w-4xl mx-auto leading-[1.08]">
            Where Ambitious Startups Meet{" "}
            <span className="text-[#1B3B6F]">
              Their Ideal Investors.
            </span>
          </h1>

          {/* Short Description */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed">
            Stop pitching into the void. Venture X analyzes confidential startup readiness, synthesizes
            investor mandates, and drives high-conviction introductions powered by explainable semantic intelligence.
          </p>

          {/* Primary Call-to-Action Buttons */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/founder/dashboard"
              className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm sm:text-base font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] shadow-sm transition-all flex items-center justify-center gap-2 group"
            >
              <Rocket className="w-4 h-4 text-white group-hover:-translate-y-0.5 transition-transform" />
              I&apos;m a Founder
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/investor/dashboard"
              className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm sm:text-base font-medium text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] shadow-sm transition-all flex items-center justify-center gap-2 group"
            >
              <Briefcase className="w-4 h-4 text-[#2E7D52] group-hover:-translate-y-0.5 transition-transform" />
              I&apos;m an Investor
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Secondary Auth Links */}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs sm:text-sm text-[#64748B]">
            <span>Already have an account?</span>
            <Link href="/login" className="text-[#1B3B6F] hover:text-[#142C54] font-semibold underline underline-offset-4">
              Sign In
            </Link>
            <span>•</span>
            <Link href="/register" className="text-[#0F172A] hover:text-[#1B3B6F] font-medium">
              Create Free Account
            </Link>
          </div>

          {/* Backend Connectivity Status Box */}
          <div className="mt-10 inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#64748B] font-mono">
            <span className={`w-2 h-2 rounded-full ${apiHealth?.status === "healthy" ? "bg-[#2E7D52]" : "bg-[#1B3B6F]"}`} />
            <span>API Backend:</span>
            <span className="text-[#0F172A] font-semibold">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span>
            <span className="text-[#94A3B8]">|</span>
            <span className={apiHealth?.status === "healthy" ? "text-[#2E7D52] font-sans font-medium" : "text-[#1B3B6F] font-sans font-medium"}>
              {apiHealth?.status === "healthy" ? "Live Connection" : "Mock Fallback"}
            </span>
          </div>
        </div>

        {/* Product Preview Panel — Deep Navy & White Interface Showcase */}
        <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-elevated overflow-hidden">
          {/* Mock Window Header */}
          <div className="px-4 py-3 bg-[#0B1628] border-b border-[#182C4C] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#182C4C]" />
              <span className="w-3 h-3 rounded-full bg-[#182C4C]" />
              <span className="w-3 h-3 rounded-full bg-[#182C4C]" />
              <span className="ml-3 text-xs font-mono text-[#8DA0B5]">venturex.platform/founder/dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#182C4C] text-[#38BDF8] border border-[#223E68] font-mono">
                🔒 Private Readiness
              </span>
            </div>
          </div>

          {/* Inner Interface Preview */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
            {/* Mock Deep Navy Sidebar */}
            <div className="md:col-span-3 bg-[#0F1E36] p-4 text-white border-r border-[#182C4C] flex flex-col justify-between hidden sm:flex">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[#182C4C]">
                  <div className="w-7 h-7 rounded-lg bg-[#182C4C] border border-[#223E68] flex items-center justify-center font-bold text-xs">
                    V<span className="text-[#38BDF8]">X</span>
                  </div>
                  <span className="font-bold text-sm tracking-tight font-display text-white">Venture X</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="px-3 py-2 rounded-lg bg-[#1C355E] text-white font-medium flex items-center gap-2 border-l-2 border-[#38BDF8]">
                    <Layers className="w-3.5 h-3.5 text-[#38BDF8]" /> Overview
                  </div>
                  <div className="px-3 py-2 rounded-lg text-[#BAC7D5] hover:text-white flex items-center gap-2">
                    <Rocket className="w-3.5 h-3.5 text-[#7B8EA5]" /> My Projects
                  </div>
                  <div className="px-3 py-2 rounded-lg text-[#BAC7D5] hover:text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" /> AI Readiness
                  </div>
                  <div className="px-3 py-2 rounded-lg text-[#BAC7D5] hover:text-white flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#7B8EA5]" /> Investors
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0B1628] border border-[#182C4C] text-[11px] text-[#8DA0B5]">
                <div className="text-white font-medium">Alex Rivers</div>
                <div className="text-[10px]">NeuroPulse AI</div>
              </div>
            </div>

            {/* Mock Content Surface */}
            <div className="md:col-span-9 bg-[#F8FAFC] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] font-display">NeuroPulse AI — Overview</h3>
                  <p className="text-xs text-[#64748B]">Ultra-low-latency edge AI diagnostics for cardiac telemedicine</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="primary">Confidential Score</Badge>
                  <Badge variant="success">96.4% Mandate Match</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Score Dial Card */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center shadow-subtle flex flex-col justify-center items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Readiness Dial</span>
                  <div className="my-2 w-20 h-20 rounded-full border-4 border-[#1B3B6F] bg-[#EBF2FA] flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-xl font-extrabold text-[#1B3B6F] font-display">92.4</span>
                      <span className="block text-[8px] text-[#64748B] uppercase font-mono">/ 100</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#2E7D52] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready to Syndicate
                  </span>
                </div>

                {/* Mandate Match Snippet */}
                <div className="sm:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#0F1E36] text-white flex items-center justify-center font-bold text-xs">
                        SL
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0F172A] font-display">Dr. Sarah Lin</div>
                        <div className="text-[10px] text-[#64748B]">Apex Horizon Ventures ($40M Fund)</div>
                      </div>
                    </div>
                    <Badge variant="success">96.4% Match</Badge>
                  </div>

                  <div className="text-xs text-[#64748B] bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0] space-y-1">
                    <div className="font-semibold text-[#0F172A] text-[11px]">Why this thesis matches:</div>
                    <div className="text-[11px] leading-relaxed">
                      Lead partner specializes in edge AI co-designs. $750K ask aligns with $500K-$1.5M target check bracket.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

      {/* Core Architecture Concept / Workflow Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="primary" size="md">Core Architecture Concept</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] mt-3 tracking-tight font-display">
            How Venture X Bridges the Gap
          </h2>
          <p className="text-[#64748B] mt-2 text-base">
            From pitch submission to verified dealflow, every step is built for explainable semantic intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] flex items-center justify-center font-bold text-xs mb-4 font-mono">
              01
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] font-display">1. Confidential Project Intake</h3>
            <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Founders document problem, solution, market size, business model, and stage.
              The AI Readiness Engine scores project completeness while keeping all data private.
            </p>
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-xs text-[#1B3B6F] font-mono">
              → Confidential Gap Detection
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-[#BFD7EE] bg-[#EBF2FA] p-6 shadow-card hover:border-[#1B3B6F] transition-all">
            <div className="w-9 h-9 rounded-lg bg-white border border-[#BFD7EE] text-[#1B3B6F] flex items-center justify-center font-bold text-xs mb-4 font-mono">
              02
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] font-display">2. Semantic Vector Synthesis</h3>
            <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Investor criteria (industries, check size bracket, stage, geography) are vectorized alongside startup
              embeddings for high-dimensional similarity matching.
            </p>
            <div className="mt-4 pt-3 border-t border-[#BFD7EE] text-xs text-[#1B3B6F] font-mono font-medium">
              → Sentence Transformers & pgvector
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] flex items-center justify-center font-bold text-xs mb-4 font-mono">
              03
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] font-display">3. Explainable Match & Connect</h3>
            <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Both parties receive explainable rationale: why this project fits the investor&apos;s mandate,
              and why this partner accelerates the founder&apos;s journey.
            </p>
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-xs text-[#2E7D52] font-mono">
              → High-Conviction Connection
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[#E2E8F0]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="secondary">Active Pipeline</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2 font-display">
              Featured Startup Projects
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Founder-approved projects showcased to registered syndicate investors.
            </p>
          </div>
          <Link
            href="/founder/projects/new"
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-8 sm:p-14 relative overflow-hidden shadow-card">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#0F172A] font-display">
              Ready to accelerate your venture?
            </h2>
            <p className="mt-3 text-[#64748B] text-sm sm:text-base leading-relaxed">
              Join high-conviction founders raising with AI-augmented pitch readiness and direct investor discovery.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/founder/projects/new"
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm"
              >
                Create Startup Profile
              </Link>
              <Link
                href="/investor/preferences"
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-[#0F172A] bg-white hover:bg-[#FAFBFD] border border-[#E2E8F0] transition-all shadow-sm"
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
