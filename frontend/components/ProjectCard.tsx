import React from "react";
import Link from "next/link";
import { Project } from "@/types";
import { Badge } from "@/components/Badge";
import { DollarSign, Layers, Sparkles, ArrowUpRight, TrendingUp } from "lucide-react";

interface ProjectCardProps {
  project: Project;
  onConnect?: (project: Project) => void;
  showActions?: boolean;
}

export function ProjectCard({ project, onConnect, showActions = true }: ProjectCardProps) {
  const formattedFunding = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(project.funding_required);

  const score = project.readiness_score ?? 85.0;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm transition-all hover:border-zinc-700 hover:shadow-xl hover:shadow-blue-500/5">
      <div>
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="indigo">{project.industry}</Badge>
            <Badge variant="secondary">{project.stage}</Badge>
            <Badge variant="outline">{project.business_model}</Badge>
          </div>

          {/* AI Readiness Score indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Score: {score.toFixed(1)}</span>
          </div>
        </div>

        {/* Project Header */}
        <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
          {project.title}
        </h3>
        {project.tagline && (
          <p className="mt-1 text-sm font-medium text-zinc-300 line-clamp-1">{project.tagline}</p>
        )}

        {/* Project Description */}
        <p className="mt-3 text-sm text-zinc-400 line-clamp-3 leading-relaxed">
          {project.description}
        </p>

        {/* Problem & Solution Snippet */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2 text-xs">
          <div>
            <span className="font-semibold text-zinc-300">Problem: </span>
            <span className="text-zinc-400 line-clamp-1">{project.problem}</span>
          </div>
          <div>
            <span className="font-semibold text-zinc-300">Solution: </span>
            <span className="text-zinc-400 line-clamp-1">{project.solution}</span>
          </div>
        </div>
      </div>

      {/* Footer / Metric & Action */}
      <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block">
            Target Raise
          </span>
          <span className="text-base font-bold text-white flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-emerald-400 -mr-1" />
            {formattedFunding.replace("$", "")}
          </span>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            {onConnect ? (
              <button
                onClick={() => onConnect(project)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1"
              >
                Connect
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href={`/founder/projects/${project.id}`}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-1"
              >
                View
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
