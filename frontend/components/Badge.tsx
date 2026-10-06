import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "indigo" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "primary",
  size = "sm",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    primary: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    secondary: "bg-zinc-800 text-zinc-300 border border-zinc-700",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    outline: "bg-transparent text-zinc-400 border border-zinc-700/60",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium rounded-full",
    md: "px-3 py-1 text-xs font-semibold rounded-full",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
