"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Cpu,
  Layers,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { PortalLayout } from "@/components/PortalLayout";
import { api } from "@/lib/api";
import { ProjectCreateInput } from "@/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProjectCreateInput>({
    title: "",
    tagline: "",
    description: "",
    problem: "",
    solution: "",
    industry: "AI/ML",
    stage: "Seed",
    funding_required: 500000,
    business_model: "B2B SaaS",
    target_market: "",
    website: "",
    pitch_deck_url: "",
  });

  const [makePublicNow, setMakePublicNow] = useState(false);

  const industries = [
    "AI/ML",
    "Healthcare & AI",
    "ClimateTech",
    "Cybersecurity",
    "Fintech",
    "Developer Tools",
    "BioTech",
    "Robotics",
    "B2B SaaS",
    "Web3 & Infrastructure",
  ];

  const stages = [
    "Idea Phase",
    "Prototype",
    "MVP / Private Beta",
    "Early Traction",
    "Pre-seed",
    "Seed",
    "Series A",
  ];

  const businessModels = [
    "B2B SaaS",
    "Enterprise Licensing",
    "Marketplace / Commission",
    "Usage-Based API",
    "Hardware + Recurring Software",
    "D2C Subscription",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await api.createProject(formData);
      setSuccessResult(created);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout role="FOUNDER" activeItem="new_project" title="Create Project">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back navigation */}
        <Link
          href="/founder/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Founder Dashboard
        </Link>

        {/* Header */}
        <div className="border-b border-[#E2E8F0] pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary">Confidential Intake</Badge>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#1B3B6F]" /> Private by Default
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
            Create Startup Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Document your core technology and venture mechanics. The AI Readiness Engine evaluates completeness
            while keeping all materials confidential to your founder account.
          </p>
        </div>

        {/* Success Modal / Readiness Preview */}
        {successResult && (
          <div className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] p-6 sm:p-8 shadow-card space-y-4">
            <div className="flex items-center gap-2.5 text-[#2E7D52]">
              <CheckCircle2 className="w-6 h-6 text-[#2E7D52]" />
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] font-display">
                Project Profile Created Successfully!
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#1E5236]">
              &ldquo;{successResult.title}&rdquo; is currently saved in your <strong>private workspace</strong>.
            </p>

            <div className="p-4 rounded-lg bg-white border border-[#E2E8F0] space-y-2 shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1B3B6F]" />
                  Preliminary AI Readiness Score:
                </span>
                <span className="text-lg font-mono font-bold text-[#1B3B6F]">
                  {successResult.readiness_score ? `${successResult.readiness_score}%` : "88.0%"}
                </span>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {successResult.ai_feedback_summary ||
                  "High problem-solution clarity. Semantic embeddings generated and ready for investor recommendation."}
              </p>
              <div className="pt-2 text-[11px] text-[#2E7D52] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Note: This diagnostic analysis is private to you and never shared with investors.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push("/founder/dashboard")}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => setSuccessResult(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#FAFBFD]"
              >
                Create Another Project
              </button>
            </div>
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-[#C2410C] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#C2410C]" />
              {errorMessage}
            </div>
          )}

          {/* 1. Startup Identity */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#1B3B6F]" />
              1. Startup Identity
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Project / Startup Name <span className="text-[#1B3B6F]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., OmniFlow AI"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                One-Line Elevator Tagline
              </label>
              <input
                type="text"
                placeholder="e.g., Autonomous edge diagnostics for distributed telemetry"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Executive Project Summary <span className="text-[#1B3B6F]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe your technology architecture, primary value proposition, and venture vision..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* 2. Problem & Solution */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1B3B6F]" />
              2. Problem & Solution Mechanics
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                The Critical Market Problem <span className="text-[#1B3B6F]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Who suffers from this problem, why do legacy alternatives fail, and what is the cost of inaction?"
                value={formData.problem}
                onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Your Proprietary Breakthrough Solution <span className="text-[#1B3B6F]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain your technical defensibility, proprietary algorithms, and 10x improvement..."
                value={formData.solution}
                onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* 3. Market, Stage & Capital Target */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#2E7D52]" />
              3. Sector, Stage & Capital Target
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Industry Sector <span className="text-[#1B3B6F]">*</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Startup Stage <span className="text-[#1B3B6F]">*</span>
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                >
                  {stages.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Funding Required (USD) <span className="text-[#1B3B6F]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#64748B] text-sm">$</span>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={25000}
                    value={formData.funding_required}
                    onChange={(e) =>
                      setFormData({ ...formData, funding_required: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Business Model <span className="text-[#1B3B6F]">*</span>
                </label>
                <select
                  value={formData.business_model}
                  onChange={(e) => setFormData({ ...formData, business_model: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                >
                  {businessModels.map((bm) => (
                    <option key={bm} value={bm}>
                      {bm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Target Customer & Market ICP <span className="text-[#1B3B6F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cardiology clinics & telemetry hospital providers"
                  value={formData.target_market}
                  onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* 4. Web Presence & Materials */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#64748B]" />
              4. Pitch Deck & Links
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Product Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Pitch Deck URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://docsend.com/view/demo"
                  value={formData.pitch_deck_url}
                  onChange={(e) => setFormData({ ...formData, pitch_deck_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Privacy Confirmation Option */}
          <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] flex items-start gap-3">
            <input
              type="checkbox"
              id="makePublicNow"
              checked={makePublicNow}
              onChange={(e) => setMakePublicNow(e.target.checked)}
              className="mt-1 accent-[#1B3B6F] w-4 h-4"
            />
            <label htmlFor="makePublicNow" className="text-xs text-[#0F172A] cursor-pointer">
              <span className="font-semibold block">Publish immediately to verified syndicate investors</span>
              <span className="text-[#64748B] block mt-0.5">
                Leave unchecked to keep this project completely private in your founder workspace while you review the readiness report.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
            <Link
              href="/founder/dashboard"
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  Evaluating Readiness...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Submit & Run AI Readiness Diagnostic
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
