"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { api } from "@/lib/api";

const HOME_FOR_ROLE = {
  FOUNDER: "/founder/dashboard",
  INVESTOR: "/investor/dashboard",
} as const;

/** Only same-site paths are honoured as post-login destinations. */
function safeRedirect(target: string | null): string | null {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return null;
  return target;
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">("FOUNDER");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(
          signInError.status === 401 || signInError.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Incorrect email or password."
            : signInError.message || "Sign-in failed. Please try again."
        );
        return;
      }

      // The account's role decides which workspace opens; finish onboarding if it was skipped.
      let me = await api.getMe();
      if (me && !me.role) {
        me = await api.completeOnboarding({ role });
      }
      const destination =
        safeRedirect(searchParams.get("redirectTo")) ?? HOME_FOR_ROLE[me?.role ?? role];
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setPending(false);
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

          {error && (
            <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "Signing in…" : `Sign In to ${role === "FOUNDER" ? "Founder Workspace" : "Investor Portal"}`}
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
