"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Briefcase,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Globe,
  UserCheck,
  Building2,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { PortalLayout } from "@/components/PortalLayout";
import { api, MOCK_PROJECTS, MOCK_MATCHES } from "@/lib/api";
import { Project, MatchItem } from "@/types";

export default function InvestorProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [matchItem, setMatchItem] = useState<MatchItem | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const found = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
    setProject(found);

    const matchFound = MOCK_MATCHES.find((m) => m.project_id === found.id) || MOCK_MATCHES[0];
    setMatchItem(matchFound);
  }, [projectId]);

  if (!project) {
    return (
      <PortalLayout role="INVESTOR" activeItem="browse" title="Project Details">
        <div className="p-8 text-center text-xs text-[#64748B]">Loading project details...</div>
      </PortalLayout>
    );
  }

  const formattedFunding = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(project.funding_required);

  const handleRequestIntro = () => {
    setRequested(true);
  };

  return (
    <PortalLayout role="INVESTOR" activeItem="browse" title={project.title}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/investor/dashboard?tab=browse"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dealflow Pipeline
        </Link>

        {/* Top Header Panel */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-subtle flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{project.industry}</Badge>
              <Badge variant="outline">{project.stage}</Badge>
              <Badge variant="outline">{project.business_model}</Badge>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F5E9] border border-[#A3E635] text-[#2E7D52] text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D52]" /> Founder-Approved Mandate
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
              {project.title}
            </h1>
            {project.tagline && (
              <p className="text-xs sm:text-sm font-medium text-[#64748B]">{project.tagline}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRequestIntro}
              disabled={requested}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm ${
                requested
                  ? "bg-[#E8F5E9] text-[#2E7D52] border border-[#A3E635]"
                  : "bg-[#1B3B6F] hover:bg-[#142C54] text-white"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              {requested ? "Intro Requested ✓" : "Request Introduction"}
            </button>
          </div>
        </div>

        {/* Semantic Mandate Fit Card */}
        {matchItem && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1B3B6F]" />
                <span className="text-xs font-bold text-[#0F172A] font-display uppercase tracking-wider">
                  Semantic Thesis Alignment: {matchItem.match_score.toFixed(1)}% Match
                </span>
              </div>
              <Badge variant="success">High Conviction</Badge>
            </div>

            <div className="space-y-1.5 text-xs text-[#64748B]">
              {matchItem.reasons.map((r, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D52] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#0F172A] font-semibold">{r.category}: </strong>
                    {r.explanation}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deal Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                Target Raise Ask
              </span>
              <span className="text-xl font-bold text-[#0F172A] font-display mt-0.5 block">
                {formattedFunding}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] border border-[#A3E635] flex items-center justify-center text-[#2E7D52]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                Round Structure
              </span>
              <span className="text-xl font-bold text-[#0F172A] font-display mt-0.5 block">
                {project.stage} / Equity
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Narrative Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  Executive Project Summary
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  Market Pain Point & Friction
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.problem}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  Proprietary Solution & Moat
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.solution}
                </p>
              </div>
            </div>
          </div>

          {/* Dealroom Info */}
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle space-y-4 text-xs">
              <h3 className="font-bold text-[#0F172A] uppercase tracking-wider font-display">
                Founder-Approved Data
              </h3>

              <div className="space-y-2">
                <div>
                  <span className="text-[#64748B] block">Target ICP:</span>
                  <span className="text-[#0F172A] font-medium">{project.target_market}</span>
                </div>

                {project.website && (
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Product URL:</span>
                    <a
                      href={project.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1B3B6F] font-medium hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {project.website.replace("https://", "")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 shadow-subtle space-y-3 text-xs">
              <div className="font-bold text-[#0F172A]">Deal Room Access</div>
              <p className="text-[#64748B] leading-relaxed">
                Connect directly with the founder to review pitch decks, financials, and clinical trial results.
              </p>
              <button
                onClick={handleRequestIntro}
                disabled={requested}
                className="w-full py-2 text-center text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-colors shadow-sm"
              >
                {requested ? "Intro Pending" : "Request Introduction"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
