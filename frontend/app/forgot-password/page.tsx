"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#0F1E36] border border-[#1F3354] items-center justify-center text-white mb-3 shadow-sm font-display font-extrabold text-sm">
            V<span className="text-[#38BDF8]">X</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight font-display">
            Reset Password
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Enter your account work email and we&apos;ll send recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div className="p-4 rounded-xl bg-[#E8F5E9] border border-[#A3E635] text-[#2E7D52] text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
              Password Reset Link Dispatched
            </div>
            <p className="text-[#2E7D52] leading-relaxed">
              If an active Venture X founder or investor account exists for <strong>{email}</strong>, a secure reset link has been dispatched.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block px-3 py-1.5 bg-[#1B3B6F] hover:bg-[#142C54] text-white rounded-lg text-xs font-medium"
              >
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Account Email Address</label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F]"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              Send Recovery Instructions
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
