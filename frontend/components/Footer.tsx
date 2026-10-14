import React from "react";
import Link from "next/link";
import { Sparkles, Cpu, Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-[#E2E8F0] bg-white text-[#64748B] py-12 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0F1E36] border border-[#1F3354] flex items-center justify-center text-white shadow-sm">
                <span className="font-display font-bold text-xs text-[#F8FAFC]">
                  V<span className="text-[#38BDF8]">X</span>
                </span>
              </div>
              <span className="text-lg font-bold text-[#0F172A] tracking-tight font-display">
                Venture<span className="text-[#1B3B6F]">X</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-sm leading-relaxed">
              Elegant AI platform bridging high-potential startup founders with thesis-aligned
              venture capital, syndicates, and angel investors through multi-dimensional semantic matching.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] pt-1">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
                <Cpu className="w-3.5 h-3.5 text-[#1B3B6F]" /> FastAPI & PyTorch
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52]">
                <Database className="w-3.5 h-3.5 text-[#2E7D52]" /> PostgreSQL & pgvector
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-display">
              Workspaces
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/founder/dashboard" className="text-[#64748B] hover:text-[#1B3B6F] transition-colors">
                  Founder Dashboard
                </Link>
              </li>
              <li>
                <Link href="/investor/dashboard" className="text-[#64748B] hover:text-[#1B3B6F] transition-colors">
                  Investor Portal
                </Link>
              </li>
              <li>
                <Link href="/founder/projects/new" className="text-[#64748B] hover:text-[#1B3B6F] transition-colors">
                  Submit Pitch & Materials
                </Link>
              </li>
              <li>
                <Link href="/investor/preferences" className="text-[#64748B] hover:text-[#1B3B6F] transition-colors">
                  Match Criteria Setup
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture & Stack */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-display">
              Design System
            </h4>
            <ul className="space-y-1.5 text-xs text-[#64748B]">
              <li>• Plus Jakarta Sans & Inter Typography</li>
              <li>• Midnight Navy & Pure White Palette</li>
              <li>• Deep Blue Accent System</li>
              <li>• Confidential Founder Readiness Model</li>
              <li>• Explainable Mandate Semantic Synthesis</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#64748B]">
          <p>© {new Date().getFullYear()} Venture X. Intelligent Founder & Investor Ecosystem.</p>
          <div className="flex gap-4">
            <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A]">
              /api/health
            </span>
            <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A]">
              /docs
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
