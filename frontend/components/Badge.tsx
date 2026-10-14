import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "indigo" | "outline" | "charcoal" | "terracotta" | "sage" | "navy";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "secondary",
  size = "sm",
  className = "",
}: BadgeProps) {
  const variantStyles: Record<string, string> = {
    // Deep Blue / Navy accent badge
    primary: "bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]",
    navy: "bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]",
    terracotta: "bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]",
    
    // Clean light slate secondary badge
    secondary: "bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]",
    
    // Positive status: muted forest emerald
    success: "bg-[#E8F5E9] text-[#2E7D52] border border-[#C8E6C9]",
    sage: "bg-[#E8F5E9] text-[#2E7D52] border border-[#C8E6C9]",
    
    // Warning status: soft amber
    warning: "bg-[#FFF7ED] text-[#C2410C] border border-[#FFEDD5]",
    
    // Indigo mapped to soft ice navy
    indigo: "bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]",
    
    // Deep Navy solid badge
    charcoal: "bg-[#0F1E36] text-white border border-[#1F3354]",
    
    // Outlined badge
    outline: "bg-transparent text-[#64748B] border border-[#E2E8F0]",
  };

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-xs font-medium rounded-full",
    md: "px-3 py-1 text-xs font-semibold rounded-full",
  };

  const selectedStyle = variantStyles[variant] || variantStyles.secondary;

  return (
    <span
      className={`inline-flex items-center gap-1.5 transition-colors tracking-tight ${sizeStyles[size]} ${selectedStyle} ${className}`}
    >
      {children}
    </span>
  );
}
