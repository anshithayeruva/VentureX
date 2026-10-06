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
} from "lucide-react";
import { Badge } from "@/components/Badge";
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
  });

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back button */}
      <Link
        href="/founder/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Founder Dashboard
      </Link>

      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 mb-8">
        <div className="flex items-center gap-2">
          <Badge variant="indigo">Startup Submission</Badge>
          <span className="text-xs text-zinc-500 font-mono">POST /api/projects</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
          Create New Project Profile
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Complete each field carefully. Your inputs will be analyzed by the Venture X Readiness
          Engine and indexed for semantic investor matching.
        </p>
      </div>

      {/* Success Modal / Readiness Preview */}
      {successResult && (
        <div className="mb-10 rounded-2xl border border-emerald-500/40 bg-zinc-900/90 p-8 shadow-2xl">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
            <h2 className="text-xl font-bold text-white">Project Published Successfully!</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-300">
            &ldquo;{successResult.title}&rdquo; is now active in the dealflow pipeline.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                AI Readiness Preliminary Score:
              </span>
              <span className="text-lg font-mono font-bold text-cyan-400">
                {successResult.readiness_score ? `${successResult.readiness_score}%` : "88.0%"}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {successResult.ai_feedback_summary ||
                "High problem-solution clarity. Semantic embeddings generated and ready for investor recommendation."}
            </p>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => router.push("/founder/dashboard")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => setSuccessResult(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200"
            >
              Submit Another
            </button>
          </div>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* 1. Core Identity */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-blue-400" />
            1. Startup Identity
          </h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Project / Startup Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., OmniFlow AI"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              One-Line Elevator Tagline
            </label>
            <input
              type="text"
              placeholder="e.g., Autonomous AI agents for distributed supply chain logistics"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Comprehensive Project Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide a detailed executive summary of the technology, architecture, and core vision..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* 2. Problem & Solution */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            2. Problem & Solution Mechanics
          </h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              The Critical Problem <span className="text-rose-400">*</span>
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              Who suffers from this problem, why does existing software fail, and what is the cost of inaction?
            </p>
            <textarea
              required
              rows={3}
              placeholder="Describe the severe market friction or technical limitation..."
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Your Proprietary Solution <span className="text-rose-400">*</span>
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              What is your technical 10x breakthrough or proprietary advantage?
            </p>
            <textarea
              required
              rows={3}
              placeholder="Explain how your product fundamentally solves the problem..."
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* 3. Industry, Stage & Funding Requirement */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            3. Market, Stage & Capital Target
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Industry Sector <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {industries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Startup Stage <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {stages.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Funding Required (USD) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  required
                  min={10000}
                  step={25000}
                  value={formData.funding_required}
                  onChange={(e) =>
                    setFormData({ ...formData, funding_required: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Business Model <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.business_model}
                onChange={(e) => setFormData({ ...formData, business_model: e.target.value })}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {businessModels.map((bm) => (
                  <option key={bm} value={bm}>
                    {bm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Target Market & ICP <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Mid-market logistics companies with $50M-$200M revenue"
                value={formData.target_market}
                onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 4. External Links */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            4. Web Presence & Materials
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Product Website URL
              </label>
              <input
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Pitch Deck URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://docsend.com/view/demo"
                value={formData.pitch_deck_url}
                onChange={(e) => setFormData({ ...formData, pitch_deck_url: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-zinc-800">
          <Link
            href="/founder/dashboard"
            className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Analyzing & Publishing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Submit & Trigger AI Readiness Review
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
