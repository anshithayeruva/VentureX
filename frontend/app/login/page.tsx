"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, clearApiToken, insecureOriginWarning, noSubscribe, sessionWasKept } from "@/lib/auth/client";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";

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
  // Browser-only check (null during server render, so hydration matches).
  const originWarning = useSyncExternalStore(noSubscribe, insecureOriginWarning, () => null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      clearApiToken(); // never reuse a previous account's token
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(
          signInError.status === 401 || signInError.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Incorrect email or password."
            : signInError.message || "Sign-in failed. Please try again."
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
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 sm:p-9 shadow-elevated">
        <div className="text-center mb-7">
          <BrandMark size={48} className="mb-3 rounded-xl" />
          <h1 className="text-3xl font-medium text-ink tracking-tight font-display">
            Sign in to VentureX
          </h1>
          <p className="text-xs text-muted mt-1">
            Welcome back.
          </p>
        </div>

        {originWarning && (
          <p role="alert" className="mb-5 text-xs text-warning bg-warning-soft border border-warning/20 rounded-lg px-3 py-2">
            {originWarning}
          </p>
        )}

        {searchParams.get("reset") === "1" && !error && (
          <p role="status" className="mb-5 text-xs text-positive bg-positive-soft border border-positive/20 rounded-lg px-3 py-2">
            Your password was updated. Sign in with the new one.
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Sign In As</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("FOUNDER")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  role === "FOUNDER"
                    ? "bg-accent text-white border-accent shadow-sm"
                    : "bg-surface text-muted border-line hover:text-ink"
                }`}
              >
                Founder
              </button>
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  role === "INVESTOR"
                    ? "bg-sidebar text-white border-sidebar shadow-sm"
                    : "bg-surface text-muted border-line hover:text-ink"
                }`}
              >
                Investor
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1">Email Address</label>
            <input id="login-email"
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent text-xs sm:text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-xs font-semibold text-ink">Password</label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-accent hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input id="login-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-lg text-ink placeholder-faint focus:outline-none focus:border-accent text-xs sm:text-sm"
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
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Don&apos;t have an account yet?{" "}
          <Link href="/register" className="text-accent hover:text-accent-hover font-semibold underline underline-offset-4">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
