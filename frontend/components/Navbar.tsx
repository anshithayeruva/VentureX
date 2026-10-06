"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, Activity, Menu, X, Rocket, Briefcase } from "lucide-react";
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
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                <div className="w-full h-full bg-zinc-950 rounded-[11px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-cyan-400 transition-transform group-hover:scale-110" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  Venture<span className="text-cyan-400 font-black">X</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase -mt-1">
                  AI Startup Match
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-zinc-800">
              <Link
                href="/founder/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
              >
                <Rocket className="w-4 h-4 text-blue-400" />
                Founder Hub
              </Link>
              <Link
                href="/investor/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
              >
                <Briefcase className="w-4 h-4 text-emerald-400" />
                Investor Portal
              </Link>
              <Link
                href="/founder/projects/new"
                className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
              >
                Submit Project
              </Link>
              <Link
                href="/investor/preferences"
                className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
              >
                Preferences
              </Link>
            </nav>
          </div>

          {/* Right Action Bar: Status Pill & Auth */}
          <div className="hidden md:flex items-center gap-3">
            {/* Backend API live indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
                apiStatus === "online"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : apiStatus === "checking"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-800/80 border-zinc-700 text-zinc-400"
              }`}
              title={apiStatus === "online" ? "FastAPI Backend is Connected" : "Connecting to Backend / Offline Fallback Active"}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiStatus === "online"
                    ? "bg-emerald-400 animate-pulse"
                    : apiStatus === "checking"
                    ? "bg-amber-400 animate-ping"
                    : "bg-zinc-500"
                }`}
              />
              <span className="font-mono text-[11px]">
                {apiStatus === "online" ? "API Live" : apiStatus === "checking" ? "Checking" : "Mock Mode"}
              </span>
            </div>

            <Link
              href="/login"
              className="px-3.5 py-1.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-md shadow-blue-600/20 hover:shadow-blue-600/40 transition-all"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 pt-2 pb-6 space-y-2">
          <Link
            href="/founder/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-base font-medium text-zinc-200 hover:bg-zinc-900 rounded-lg"
          >
            <Rocket className="w-4 h-4 text-blue-400" />
            Founder Dashboard
          </Link>
          <Link
            href="/investor/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-base font-medium text-zinc-200 hover:bg-zinc-900 rounded-lg"
          >
            <Briefcase className="w-4 h-4 text-emerald-400" />
            Investor Dashboard
          </Link>
          <Link
            href="/founder/projects/new"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg"
          >
            Create New Project
          </Link>
          <Link
            href="/investor/preferences"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg"
          >
            Investment Preferences
          </Link>
          <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-medium text-zinc-300 bg-zinc-900 rounded-lg"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
