import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, change, icon: Icon, subtext, trend = "up" }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle hover:border-[#CBD5E1] transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE] flex items-center justify-center text-[#1B3B6F]">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] font-display">{value}</span>
        {change && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trend === "up"
                ? "bg-[#E8F5E9] text-[#2E7D52]"
                : trend === "down"
                ? "bg-[#FFF7ED] text-[#C2410C]"
                : "bg-[#F1F5F9] text-[#64748B]"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1.5 text-xs text-[#64748B]">{subtext}</p>}
    </div>
  );
}
