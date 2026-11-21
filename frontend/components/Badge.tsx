import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "indigo" | "outline" | "charcoal" | "terracotta" | "sage" | "navy";
  size?: "sm" | "md";
  className?: string;
}

/** Quiet label: soft fill, no border, small rounded corners. */
export function Badge({ children, variant = "secondary", size = "sm", className = "" }: BadgeProps) {
  const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    primary: "bg-accent-soft text-accent",
    navy: "bg-accent-soft text-accent",
    indigo: "bg-accent-soft text-accent",
    terracotta: "bg-accent-soft text-accent",
    secondary: "bg-subtle text-ink-2",
    success: "bg-positive-soft text-positive",
    sage: "bg-positive-soft text-positive",
    warning: "bg-warning-soft text-warning",
    charcoal: "bg-ink text-white",
    outline: "bg-transparent text-muted ring-1 ring-inset ring-line",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${sizeStyles[size]} ${variantStyles[variant] ?? variantStyles.secondary} ${className}`}
    >
      {children}
    </span>
  );
}
