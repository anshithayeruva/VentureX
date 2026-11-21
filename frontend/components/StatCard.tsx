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

/** A single number with its label. `change` reads as a quiet note next to the value. */
export function StatCard({ label, value, change, icon: Icon, subtext }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="w-4 h-4 text-faint" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink tabular-nums">{value}</span>
        {change && <span className="text-xs text-muted">{change}</span>}
      </div>
      {subtext && <p className="mt-1 text-xs text-muted">{subtext}</p>}
    </div>
  );
}
