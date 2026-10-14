"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Rocket, Briefcase, ArrowRight, ShieldCheck, Lock } from "lucide-react";
import { Badge } from "@/components/Badge";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">("FOUNDER");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "FOUNDER") {
      router.push("/founder/dashboard");
    } else {
      router.push("/investor/dashboard");
    }
  };

  const handleDemoLogin = (targetRole: "FOUNDER" | "INVESTOR") => {
    if (targetRole === "FOUNDER") {
      router.push("/founder/dashboard");
    } else {
      router.push("/investor/dashboard");
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-9 shadow-elevated">
        <div className="text-center mb-7">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#0F1E36] border border-[#1F3354] items-center justify-center text-white mb-3 shadow-sm font-display font-extrabold text-sm">
            V<span className="text-[#38BDF8]">X</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight font-display">
            Sign in to Venture X
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Access your confidential founder workspace or investor dealflow.
          </p>
        </div>

        {/* Quick Demo Access Triggers */}
        <div className="mb-6 p-4 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block text-center">
            ⚡ Quick Demo Sign-In
          </span>
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={() => handleDemoLogin("FOUNDER")}
              className="py-2 px-3 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE] text-[#1B3B6F] hover:bg-[#1B3B6F] hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-subtle"
            >
              <Rocket className="w-3.5 h-3.5" />
              Demo Founder
            </button>
            <button
              onClick={() => handleDemoLogin("INVESTOR")}
              className="py-2 px-3 rounded-lg bg-[#0F1E36] text-white hover:bg-[#1C355E] text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-subtle"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Demo Investor
            </button>
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-5">
          <div className="flex-grow border-t border-[#E2E8F0]" />
          <span className="flex-shrink mx-3 text-[#94A3B8] text-[11px] uppercase font-mono">
            Or with credentials
          </span>
          <div className="flex-grow border-t border-[#E2E8F0]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Sign In As</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  role === "FOUNDER"
                    ? "bg-[#1B3B6F] text-white border-[#1B3B6F] shadow-sm"
                    : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]"
                }`}
              >
                Founder Workspace
              </button>
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  role === "INVESTOR"
                    ? "bg-[#0F1E36] text-white border-[#0F1E36] shadow-sm"
                    : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]"
                }`}
              >
                Investor Portal
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#0F172A]">Password</label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-[#1B3B6F] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm"
          >
            Sign In to {role === "FOUNDER" ? "Founder Workspace" : "Investor Portal"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#64748B]">
          Don&apos;t have an account yet?{" "}
          <Link href="/register" className="text-[#1B3B6F] hover:text-[#142C54] font-semibold underline underline-offset-4">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
