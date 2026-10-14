import React from "react";
import { MatchItem } from "@/types";
import { Badge } from "@/components/Badge";
import { Sparkles, Building2, CheckCircle2, UserCheck } from "lucide-react";

interface InvestorCardProps {
  match: MatchItem;
  onExpressInterest?: (match: MatchItem) => void;
}

export function InvestorCard({ match, onExpressInterest }: InvestorCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle hover:border-[#CBD5E1] hover:shadow-card transition-all flex flex-col justify-between">
      <div>
        {/* Header & Match Score */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F1E36] border border-[#1F3354] flex items-center justify-center font-bold text-white text-sm shadow-sm font-display">
              {match.investor_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug font-display">
                {match.investor_name}
              </h4>
              {match.investor_firm && (
                <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                  {match.investor_firm}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] text-xs font-semibold">
              <Sparkles className="w-3 h-3 text-[#2E7D52]" />
              {match.match_score.toFixed(1)}% Match
            </div>
            <span className="block text-[10px] text-[#64748B] mt-0.5 font-medium">Thesis Fit</span>
          </div>
        </div>

        {/* Explainable AI Match Reasons */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
            Why this is a good match:
          </span>
          <div className="space-y-2">
            {match.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D52] shrink-0 mt-0.5" />
                <span className="text-[#64748B] leading-relaxed">
                  <strong className="text-[#0F172A] font-semibold">{reason.category}: </strong>
                  {reason.explanation}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-5 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
        <span className="text-xs text-[#64748B]">Target: <strong className="text-[#0F172A]">{match.project_title}</strong></span>
        <button
          onClick={() => onExpressInterest?.(match)}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Request Introduction
        </button>
      </div>
    </div>
  );
}
