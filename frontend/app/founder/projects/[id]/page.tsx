"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Sparkles,
  Lock,
  Eye,
  CheckCircle2,
  DollarSign,
  Building2,
  Globe,
  FileText,
  Edit,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { PortalLayout } from "@/components/PortalLayout";
import { api, MOCK_PROJECTS } from "@/lib/api";
import { Project } from "@/types";

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const projectId = parseInt(resolvedParams.id, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const found = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
    setProject(found);
    setIsPublished(found.id === 1);
  }, [projectId]);

  if (!project) {
    return (
      <PortalLayout role="FOUNDER" activeItem="projects" title="Project Overview">
        <div className="p-8 text-center text-xs text-[#64748B]">Loading project details...</div>
      </PortalLayout>
    );
  }

  const formattedFunding = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(project.funding_required);

  return (
    <PortalLayout role="FOUNDER" activeItem="projects" title={project.title}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/founder/dashboard?tab=projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects Inventory
        </Link>

        {/* Top Header Panel */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-subtle flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{project.industry}</Badge>
              <Badge variant="outline">{project.stage}</Badge>
              <Badge variant="outline">{project.business_model}</Badge>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isPublished
                    ? "bg-[#E8F5E9] text-[#2E7D52] border border-[#C8E6C9]"
                    : "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
                }`}
              >
                {isPublished ? (
                  <>
                    <Eye className="w-3 h-3 text-[#2E7D52]" /> Published to Investors
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-[#1B3B6F]" /> Private Draft
                  </>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
              {project.title}
            </h1>
            {project.tagline && (
              <p className="text-xs sm:text-sm font-medium text-[#64748B]">{project.tagline}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsPublished(!isPublished)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors border ${
                isPublished
                  ? "bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]"
                  : "bg-[#1B3B6F] text-white hover:bg-[#142C54] border-transparent"
              }`}
            >
              {isPublished ? "Set to Private Draft" : "Publish to Syndicate"}
            </button>
            <Link
              href={`/founder/projects/${project.id}/edit`}
              className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#0F1E36] hover:bg-[#0B1628] text-white transition-colors flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Confidential AI Score & Capital Raise Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                Target Raise
              </span>
              <span className="text-xl font-bold text-[#0F172A] font-display mt-0.5 block">
                {formattedFunding}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2E7D52]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                Readiness Score (Private)
              </span>
              <span className="text-xl font-bold text-[#1B3B6F] font-display mt-0.5 block">
                {project.readiness_score?.toFixed(1) || "92.4"} / 100
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE] flex items-center justify-center text-[#1B3B6F]">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                Syndicate Matches
              </span>
              <span className="text-xl font-bold text-[#0F172A] font-display mt-0.5 block">
                3 Qualified Funds
              </span>
            </div>
            <Link
              href="/founder/dashboard?tab=investors"
              className="text-xs font-semibold text-[#1B3B6F] hover:underline"
            >
              View →
            </Link>
          </div>
        </div>

        {/* Narrative Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  Project Description
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  The Market Problem
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.problem}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display">
                  Proprietary Solution
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  {project.solution}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Metadata */}
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle space-y-4 text-xs">
              <h3 className="font-bold text-[#0F172A] uppercase tracking-wider font-display">
                Venture Metadata
              </h3>

              <div className="space-y-2">
                <div>
                  <span className="text-[#64748B] block">Target Market / ICP:</span>
                  <span className="text-[#0F172A] font-medium">{project.target_market}</span>
                </div>

                {project.website && (
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Website:</span>
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

                <div className="pt-2 border-t border-[#E2E8F0]">
                  <span className="text-[#64748B] block">Created:</span>
                  <span className="text-[#0F172A] font-mono text-[11px]">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Readiness Dial Link */}
            <div className="rounded-xl border border-[#BFD7EE] bg-[#EBF2FA] p-5 shadow-subtle space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1B3B6F]">
                <Sparkles className="w-4 h-4 text-[#1B3B6F]" />
                AI Diagnostic Report
              </div>
              <p className="text-xs text-[#18345D] leading-relaxed">
                Review your full breakdown across Market Sizing, Problem-Solution fit, and clinical traction.
              </p>
              <Link
                href="/founder/dashboard?tab=readiness"
                className="inline-block px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors"
              >
                Open Full Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
