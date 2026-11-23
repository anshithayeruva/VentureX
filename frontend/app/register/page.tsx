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
  // Investors send evidence at sign-up; an admin reviews it before they can contact founders.
  const [linkedin, setLinkedin] = useState("");
  const [firmWebsite, setFirmWebsite] = useState("");
  const [pastCompany, setPastCompany] = useState("");
  const [pastYear, setPastYear] = useState("");
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
      try {
        await api.completeOnboarding({
          role,
          name: fullName,
          organization: role === "INVESTOR" ? organization || undefined : undefined,
        });
      } catch {
        // The account exists now; only the workspace setup didn't finish. Signing in completes it.
        setError(
          `Your account was created, but we couldn't finish setting it up. Sign in as ${
            role === "FOUNDER" ? "a Founder" : "an Investor"
          } to finish.`
        );
        return;
      }
      if (role === "INVESTOR") {
        try {
          await api.submitInvestorVerification({
            linkedin_url: linkedin,
            website: firmWebsite,
            past_investments: [{ company: pastCompany.trim(), year: pastYear ? parseInt(pastYear, 10) || null : null }],
          });
          router.replace("/investor/dashboard");
        } catch {
          // The account works; the evidence can be fixed on the Verification page.
          router.replace("/investor/verification");
        }
        router.refresh();
        return;
      }
      router.replace("/founder/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 sm:p-9 shadow-elevated">
        <div className="text-center mb-7">
          <BrandMark size={48} className="mb-3 rounded-xl" />
          <h1 className="text-3xl font-medium text-ink tracking-tight font-display">
            Create your VentureX account
          </h1>
          <p className="text-xs text-muted mt-1">
            Free to start. Tell us whether you&apos;re raising or investing.
          </p>
        </div>

        {originWarning && (
          <p role="alert" className="mb-5 text-xs text-warning bg-warning-soft border border-warning/20 rounded-lg px-3 py-2">
            {originWarning}
          </p>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs sm:text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">I am a</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  role === "FOUNDER"
                    ? "bg-accent text-white border-accent shadow-sm"
                    : "bg-surface text-muted border-line hover:text-ink"
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
                    ? "bg-sidebar text-white border-sidebar shadow-sm"
                    : "bg-surface text-muted border-line hover:text-ink"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Investor
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-ink mb-1">Full Name</label>
            <input id="reg-name"
              type="text"
              required
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent"
            />
          </div>

          {/* Founders add each startup as a project after signing up (they can have several),
              so only investors are asked for an organization here. */}
          {role === "INVESTOR" && (
            <div>
              <label htmlFor="reg-org" className="block text-xs font-semibold text-ink mb-1">
                Firm or fund
              </label>
              <input id="reg-org"
                type="text"
                placeholder="e.g. Horizon Seed Capital"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {role === "INVESTOR" && (
            <fieldset className="space-y-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-xs font-semibold text-ink">Verification</legend>
              <p className="text-xs text-muted">
                An admin checks these before you can contact founders. Until then you can explore startups.
              </p>
              <div>
                <label htmlFor="reg-linkedin" className="block text-xs font-semibold text-ink mb-1">LinkedIn profile</label>
                <input id="reg-linkedin" type="text" required placeholder="linkedin.com/in/your-name" value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)} className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label htmlFor="reg-website" className="block text-xs font-semibold text-ink mb-1">Firm website</label>
                <input id="reg-website" type="text" required placeholder="yourfund.in" value={firmWebsite}
                  onChange={(e) => setFirmWebsite(e.target.value)} className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
                <div>
                  <label htmlFor="reg-past" className="block text-xs font-semibold text-ink mb-1">A past investment</label>
                  <input id="reg-past" type="text" required placeholder="Company name" value={pastCompany}
                    onChange={(e) => setPastCompany(e.target.value)} className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label htmlFor="reg-past-year" className="block text-xs font-semibold text-ink mb-1">Year</label>
                  <input id="reg-past-year" type="text" inputMode="numeric" placeholder="2024" value={pastYear}
                    onChange={(e) => setPastYear(e.target.value)} className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent" />
                </div>
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-ink mb-1">Email</label>
            <input id="reg-email"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-ink mb-1">Password</label>
            <input id="reg-password"
              type="password"
              required
              placeholder="Minimum 8 characters"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Already registered?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
