"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X, Rocket, Briefcase, Activity } from "lucide-react";
import { api } from "@/lib/api";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "mock">("checking");

  useEffect(() => {
    let mounted = true;
    api.checkHealth()
      .then((res) => {
        if (!mounted) return;
        if (res.status === "healthy") {
          setApiStatus("online");
        } else {
          setApiStatus("mock");
        }
      })
      .catch(() => {
        if (mounted) setApiStatus("mock");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#0F1E36] border border-[#1F3354] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
                <span className="font-display font-extrabold text-sm text-[#F8FAFC]">
                  V<span className="text-[#38BDF8]">X</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-[#0F172A] font-display flex items-center">
                  Venture<span className="text-[#1B3B6F] font-black">X</span>
                </span>
                <span className="text-[10px] text-[#64748B] font-medium tracking-wider uppercase -mt-1">
                  AI Match & Readiness
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-6 border-l border-[#E2E8F0]">
              <Link
                href="/founder/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#0F172A] hover:text-[#1B3B6F] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                <Rocket className="w-3.5 h-3.5 text-[#1B3B6F]" />
                Founder Workspace
              </Link>
              <Link
                href="/investor/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#0F172A] hover:text-[#1B3B6F] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#2E7D52]" />
                Investor Portal
              </Link>
              <Link
                href="/founder/projects/new"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                Submit Pitch
              </Link>
              <Link
                href="/investor/preferences"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                Match Criteria
              </Link>
            </nav>
          </div>

          {/* Right Action Bar: Status Pill & Auth */}
          <div className="hidden md:flex items-center gap-3">
            {/* Backend API live indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
                apiStatus === "online"
                  ? "bg-[#E8F5E9] border-[#C8E6C9] text-[#2E7D52]"
                  : apiStatus === "checking"
                  ? "bg-[#EBF2FA] border-[#BFD7EE] text-[#1B3B6F]"
                  : "bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B]"
              }`}
              title={apiStatus === "online" ? "FastAPI Backend is Online" : "Connecting to Backend / Offline Fallback Active"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiStatus === "online"
                    ? "bg-[#2E7D52]"
                    : apiStatus === "checking"
                    ? "bg-[#1B3B6F] animate-pulse"
                    : "bg-[#94A3B8]"
                }`}
              />
              <span className="font-mono text-[11px] font-medium">
                {apiStatus === "online" ? "API Live" : apiStatus === "checking" ? "Connecting" : "Mock Ready"}
              </span>
            </div>

            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#0F172A] hover:text-[#1B3B6F] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-[#F1F5F9] focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E2E8F0] bg-white px-4 pt-3 pb-6 space-y-2 shadow-card">
          <Link
            href="/founder/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg"
          >
            <Rocket className="w-4 h-4 text-[#1B3B6F]" />
            Founder Workspace
          </Link>
          <Link
            href="/investor/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg"
          >
            <Briefcase className="w-4 h-4 text-[#2E7D52]" />
            Investor Portal
          </Link>
          <Link
            href="/founder/projects/new"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg"
          >
            Submit Pitch & Project
          </Link>
          <Link
            href="/investor/preferences"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg"
          >
            Investment Preferences
          </Link>
          <div className="pt-3 border-t border-[#E2E8F0] flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-medium text-[#0F172A] bg-[#F1F5F9] rounded-lg"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] rounded-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
