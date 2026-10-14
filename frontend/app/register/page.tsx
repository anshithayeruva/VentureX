"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Rocket, Briefcase, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/Badge";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">("FOUNDER");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "FOUNDER") {
      router.push("/founder/dashboard");
    } else {
      router.push("/investor/dashboard");
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-9 shadow-elevated">
        <div className="text-center mb-7">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#0F1E36] border border-[#1F3354] items-center justify-center text-white mb-3 shadow-sm font-display font-extrabold text-sm">
            V<span className="text-[#38BDF8]">X</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight font-display">
            Create Venture X Account
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Choose your account workspace to activate tailored workflows.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 text-xs sm:text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Select Workspace</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  role === "FOUNDER"
                    ? "bg-[#1B3B6F] text-white border-[#1B3B6F] shadow-sm"
                    : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]"
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                Founder Workspace
              </button>
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  role === "INVESTOR"
                    ? "bg-[#0F1E36] text-white border-[#0F1E36] shadow-sm"
                    : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Investor Portal
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              {role === "FOUNDER" ? "Startup / Venture Name" : "Investment Firm / Syndicate"}
            </label>
            <input
              type="text"
              placeholder={role === "FOUNDER" ? "e.g. Synthetix Labs" : "e.g. Horizon Seed Capital"}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Work Email</label>
            <input
              type="email"
              required
              placeholder="jordan@venture.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm"
          >
            Create {role === "FOUNDER" ? "Founder" : "Investor"} Account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#64748B]">
          Already registered?{" "}
          <Link href="/login" className="text-[#1B3B6F] hover:text-[#142C54] font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
