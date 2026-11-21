import React from "react";

/**
 * VentureX brand mark: a navy chevron and a blue chevron facing each other around a
 * green dot, drawn symmetrically on a 64x64 grid so the mark sits exactly centred.
 * Keep this in sync with app/icon.svg (the browser-tab icon).
 */
export const BRAND_COLORS = {
  navy: "#14233F",
  blue: "#1D4E96",
  green: "#2E9461",
} as const;

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="VentureX" focusable="false">
      {/* Left chevron (points right), right chevron (points left): exact mirror images about x = 32. */}
      <path
        d="M8 14 H20 L25.5 32 L20 50 H8 L13.5 32 Z"
        fill={BRAND_COLORS.navy}
        stroke={BRAND_COLORS.navy}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M56 14 H44 L38.5 32 L44 50 H56 L50.5 32 Z"
        fill={BRAND_COLORS.blue}
        stroke={BRAND_COLORS.blue}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="4.8" fill={BRAND_COLORS.green} />
    </svg>
  );
}

/** The mark on its white rounded tile, sized in pixels (used in nav bars, headers and cards). */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white border border-[#E2E8F0] shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <BrandGlyph className="w-full h-full" />
    </span>
  );
}
