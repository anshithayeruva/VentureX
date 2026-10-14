import React from "react";
import Link from "next/link";
import { Project } from "@/types";
import { Badge } from "@/components/Badge";
import { DollarSign, Sparkles, ArrowUpRight, Lock, CheckCircle2 } from "lucide-react";

interface ProjectCardProps {
  project: Project;
  onConnect?: (project: Project) => void;
  showActions?: boolean;
  isInvestorView?: boolean;
}

export function ProjectCard({
  project,
  onConnect,
  showActions = true,
  isInvestorView = false,
}: ProjectCardProps) {
  const formattedFunding = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(project.funding_required);

  const score = project.readiness_score ?? 85.0;

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] hover:shadow-card transition-all">
      <div>
        {/* Top Badges & Privacy/Readiness indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{project.industry}</Badge>
            <Badge variant="outline">{project.stage}</Badge>
            <Badge variant="outline">{project.business_model}</Badge>
          </div>

          {/* Critical Privacy Rule #7: Only founders see private readiness score */}
          {!isInvestorView ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EBF2FA] border border-[#BFD7EE] text-[#1B3B6F] text-xs font-semibold"
              title="Confidential AI Readiness Score (Private to Founder)"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1B3B6F]" />
              <span>Readiness: {score.toFixed(1)}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] text-xs font-medium"
              title="Founder-approved dealflow verified by Venture X"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D52]" />
              <span>Verified Mandate</span>
            </div>
          )}
        </div>

        {/* Project Header */}
        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] font-display group-hover:text-[#1B3B6F] transition-colors">
          {project.title}
        </h3>
        {project.tagline && (
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#64748B] line-clamp-1">{project.tagline}</p>
        )}

        {/* Project Description */}
        <p className="mt-2.5 text-xs sm:text-sm text-[#64748B] line-clamp-3 leading-relaxed">
          {project.description}
        </p>

        {/* Problem & Solution Snippet */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] space-y-1.5 text-xs">
          <div>
            <span className="font-semibold text-[#0F172A]">Problem: </span>
            <span className="text-[#64748B] line-clamp-1">{project.problem}</span>
          </div>
          <div>
            <span className="font-semibold text-[#0F172A]">Solution: </span>
            <span className="text-[#64748B] line-clamp-1">{project.solution}</span>
          </div>
        </div>
      </div>

      {/* Footer / Metric & Action */}
      <div className="mt-5 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
            Target Raise
          </span>
          <span className="text-base font-bold text-[#0F172A] flex items-center gap-0.5 font-display">
            <DollarSign className="w-4 h-4 text-[#2E7D52] -mr-0.5" />
            {formattedFunding.replace("$", "")}
          </span>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            {onConnect ? (
              <button
                onClick={() => onConnect(project)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                Connect
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href={`/founder/projects/${project.id}`}
                className="px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:text-[#1B3B6F] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-lg transition-colors flex items-center gap-1"
              >
                Overview
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
