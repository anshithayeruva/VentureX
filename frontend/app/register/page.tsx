"use client";

import React, { Suspense, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Rocket, Briefcase } from "lucide-react";
import { authClient, clearApiToken, insecureOriginWarning, noSubscribe, sessionWasKept } from "@/lib/auth/client";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "/register?role=investor" opens with the investor option selected.
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">(
    searchParams.get("role")?.toUpperCase() === "INVESTOR" ? "INVESTOR" : "FOUNDER"
  );
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Browser-only check (null during server render, so hydration matches).
  const originWarning = useSyncExternalStore(noSubscribe, insecureOriginWarning, () => null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      clearApiToken(); // never reuse a previous account's token
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name: fullName,
      });
      if (signUpError) {
        setError(
          signUpError.code === "USER_ALREADY_EXISTS" || signUpError.status === 422
            ? "An account with this email already exists. Sign in instead."
            : signUpError.message || "Sign-up failed. Please try again."
        );
        return;
      }
      if (!(await sessionWasKept())) {
        setError(
          insecureOriginWarning() ??
            "You were signed in, but your browser didn't keep the session (cookies may be blocked for this site). " +
              "Allow cookies for localhost and try again."
        );
        return;
      }

      // Record the workspace choice and create the matching profile.
      await api.completeOnboarding({
        role,
        name: fullName,
        organization: organization || undefined,
      });
      router.replace(role === "FOUNDER" ? "/founder/dashboard" : "/investor/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-9 shadow-elevated">
        <div className="text-center mb-7">
          <BrandMark size={48} className="mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight font-display">
            Create your VentureX account
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Free to start. Tell us whether you&apos;re raising or investing.
          </p>
        </div>

        {originWarning && (
          <p role="alert" className="mb-5 text-xs text-[#9A3412] bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-3 py-2">
            {originWarning}
          </p>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs sm:text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">I am a</label>
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
                Founder
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
                Investor
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              {role === "FOUNDER" ? "Startup name" : "Firm or fund"}
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
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="you@company.com"
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
              placeholder="Minimum 8 characters"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
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
            {pending ? "Creating account…" : "Create account"}
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
