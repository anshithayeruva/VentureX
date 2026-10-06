import React from "react";
import { MatchItem } from "@/types";
import { Badge } from "@/components/Badge";
import { Sparkles, Building2, CheckCircle2, ChevronRight, UserCheck } from "lucide-react";

interface InvestorCardProps {
  match: MatchItem;
  onExpressInterest?: (match: MatchItem) => void;
}

export function InvestorCard({ match, onExpressInterest }: InvestorCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm hover:border-zinc-700 transition-all flex flex-col justify-between">
      <div>
        {/* Header & Match Score */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-md">
              {match.investor_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-lg font-bold text-white leading-snug">{match.investor_name}</h4>
              {match.investor_firm && (
                <p className="text-xs text-zinc-400 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                  {match.investor_firm}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Sparkles className="w-3 h-3" />
              {match.match_score.toFixed(1)}% Match
            </div>
            <span className="block text-[10px] text-zinc-500 mt-0.5">Semantic AI Fit</span>
          </div>
        </div>

        {/* Explainable AI Match Reasons */}
        <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
            Why this is a good match:
          </span>
          <div className="space-y-2">
            {match.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300">
                  <strong className="text-white">{reason.category}: </strong>
                  {reason.explanation}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Target Project: {match.project_title}</span>
        <button
          onClick={() => onExpressInterest?.(match)}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Request Introduction
        </button>
      </div>
    </div>
  );
}
