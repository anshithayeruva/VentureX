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
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm shadow-sm hover:border-zinc-700/80 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{value}</span>
        {change && (
          <span
            className={`text-xs font-semibold ${
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-zinc-400"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-zinc-500">{subtext}</p>}
    </div>
  );
}
