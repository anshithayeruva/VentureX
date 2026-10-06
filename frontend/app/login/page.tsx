"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Rocket, Briefcase, ArrowRight, ShieldCheck } from "lucide-react";
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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 items-center justify-center text-blue-400 mb-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to Venture X</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Access your AI dealflow dashboard or startup workspace.
          </p>
        </div>

        {/* Quick Demo Login Triggers */}
        <div className="mb-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block text-center">
            ⚡ Quick Demo Access:
          </span>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleDemoLogin("FOUNDER")}
              className="py-2 px-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Rocket className="w-3.5 h-3.5" />
              Demo Founder
            </button>
            <button
              onClick={() => handleDemoLogin("INVESTOR")}
              className="py-2 px-3 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Demo Investor
            </button>
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-zinc-800" />
          <span className="flex-shrink mx-3 text-zinc-500 text-xs uppercase font-mono">Or with credentials</span>
          <div className="flex-grow border-t border-zinc-800" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Sign In As</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === "FOUNDER"
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                Founder
              </button>
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === "INVESTOR"
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                Investor
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@domain.com"
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
          >
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Don&apos;t have an account yet?{" "}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
