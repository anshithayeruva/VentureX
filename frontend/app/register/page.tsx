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
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 items-center justify-center text-blue-400 mb-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Venture X Account</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Choose your account role to activate tailored features.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Select Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === "FOUNDER"
                    ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <Rocket className="w-4 h-4" />
                Founder
              </button>
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === "INVESTOR"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Investor
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              {role === "FOUNDER" ? "Startup / Company Name" : "Investment Firm / Fund"}
            </label>
            <input
              type="text"
              placeholder={role === "FOUNDER" ? "e.g. Synthetix Labs" : "e.g. Horizon Seed Capital"}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Work Email</label>
            <input
              type="email"
              required
              placeholder="jordan@venture.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
          >
            Create {role === "FOUNDER" ? "Founder" : "Investor"} Account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Already registered?{" "}
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
