"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { authClient } from "@/lib/auth/client";

/**
 * Password reset with a one-time code. Neon Auth emails the code itself; codes (unlike
 * reset links) work on its shared mail sender, so no SMTP setup is needed in development.
 */

const MIN_PASSWORD = 8;
const inputClass =
  "w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]";
const buttonClass =
  "w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait";

type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

function codeErrorMessage(err: AuthError): string {
  // The client may surface the server's code ("INVALID_OTP") or only its message ("Invalid OTP").
  const code = (err?.code || err?.message || "").toUpperCase().replace(/[\s-]+/g, "_");
  if (code === "INVALID_OTP") return "That code isn't right. Check the email and try again.";
  if (code === "OTP_EXPIRED") return "That code has expired. Send a new one.";
  if (code === "TOO_MANY_ATTEMPTS") return "Too many wrong attempts. Send a new code.";
  if (err?.status === 429) return "Too many requests. Wait a minute and try again.";
  return err?.message || "Couldn't reset the password. Please try again.";
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "forget-password",
      });
      if (sendError) {
        setError(
          sendError.status === 429
            ? "Too many requests. Wait a minute and try again."
            : sendError.message || "Couldn't send the code. Please try again."
        );
        return;
      }
      // Same message whether or not the account exists, so emails can't be probed.
      setNotice(`If an account exists for ${email.trim()}, we've emailed it a 6-digit code.`);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the new password.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setPending(true);
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password,
      });
      if (resetError) {
        setError(codeErrorMessage(resetError));
        return;
      }
      router.replace("/login?reset=1");
    } catch (err) {
      setError(codeErrorMessage(err instanceof Error ? { message: err.message } : null));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-9 shadow-elevated">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Sign In
        </Link>

        <div className="text-center mb-6">
          <BrandMark size={48} className="mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight font-display">Reset Password</h1>
          <p className="text-xs text-[#64748B] mt-1">
            {step === "email"
              ? "Enter your account email and we'll send you a 6-digit code."
              : "Enter the code from the email and choose a new password."}
          </p>
        </div>

        {notice && (
          <p className="mb-4 text-xs text-[#2E7D52] bg-[#E8F5E9] border border-[#C8E6C9] rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#0F172A] mb-1">
                Account Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={pending} className={buttonClass}>
              <Mail className="w-4 h-4" />
              {pending ? "Sending…" : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label htmlFor="otp" className="block text-xs font-semibold text-[#0F172A] mb-1">
                6-Digit Code
              </label>
              <input
                id="otp"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} font-mono tracking-[0.4em] text-center`}
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-[#0F172A] mb-1">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD} characters`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-[#0F172A] mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={pending} className={buttonClass}>
              <KeyRound className="w-4 h-4" />
              {pending ? "Updating…" : "Set New Password"}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-[#64748B] hover:text-[#0F172A]"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => sendCode()}
                className="font-semibold text-[#1B3B6F] hover:underline disabled:opacity-60"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
