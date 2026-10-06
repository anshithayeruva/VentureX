"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Globe,
  DollarSign,
  Cpu,
  Layers,
  Save,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { api, MOCK_INVESTOR_PREFERENCE } from "@/lib/api";
import { InvestorPreference } from "@/types";

export default function InvestorPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [preferences, setPreferences] = useState<InvestorPreference>(MOCK_INVESTOR_PREFERENCE);

  const availableIndustries = [
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

  const availableStages = [
    "Idea Phase",
    "Prototype",
    "MVP / Beta",
    "Pre-seed",
    "Seed",
    "Series A",
    "Series B",
  ];

  const availableBusinessModels = [
    "B2B SaaS",
    "Enterprise Infrastructure",
    "Marketplace / Commission",
    "Usage-Based API",
    "DeepTech IP Licensing",
    "Hardware + Software",
  ];

  const availableTechs = [
    "Generative AI & LLMs",
    "Edge Machine Learning",
    "Post-Quantum Cryptography",
    "Computer Vision",
    "Bioinformatics",
    "Autonomous Robotics",
  ];

  useEffect(() => {
    let mounted = true;
    api.getInvestorPreferences().then((data) => {
      if (mounted && data) setPreferences(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleItem = (listKey: keyof InvestorPreference, item: string) => {
    const currentList = (preferences[listKey] as string[]) || [];
    const updated = currentList.includes(item)
      ? currentList.filter((i) => i !== item)
      : [...currentList, item];
    setPreferences({ ...preferences, [listKey]: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateInvestorPreferences(preferences);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to update preferences", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back button */}
      <Link
        href="/investor/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Investor Dashboard
      </Link>

      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 mb-8">
        <div className="flex items-center gap-2">
          <Badge variant="success">Investment Mandate</Badge>
          <span className="text-xs text-zinc-500 font-mono">PUT /api/investors/preferences</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
          Investor Matching Criteria
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Tune your portfolio filters. Venture X matches incoming founder projects with your preferred
          industries, check size bracket, and stage focus.
        </p>
      </div>

      {saveSuccess && (
        <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Investment criteria saved! Future AI embeddings will vectorize these filters.</span>
          </div>
          <button
            onClick={() => router.push("/investor/dashboard")}
            className="text-xs font-bold text-white underline underline-offset-4"
          >
            View Matched Deals →
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* 1. Preferred Industries */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              1. Preferred Industries & Sectors
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select all verticals where your fund holds an active mandate.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {availableIndustries.map((ind) => {
              const selected = preferences.preferred_industries.includes(ind);
              return (
                <button
                  type="button"
                  key={ind}
                  onClick={() => toggleItem("preferred_industries", ind)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    selected
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                      : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {selected && "✓ "}
                  {ind}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Startup Stages */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              2. Target Startup Stages
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Which development milestones are appropriate for your first check?
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {availableStages.map((stg) => {
              const selected = preferences.preferred_stages.includes(stg);
              return (
                <button
                  type="button"
                  key={stg}
                  onClick={() => toggleItem("preferred_stages", stg)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    selected
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-500"
                      : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {selected && "✓ "}
                  {stg}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Investment Range */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              3. Check Size & Investment Range (USD)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Specify your minimum and maximum initial allocation per startup.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Minimum Check Size ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min={5000}
                  step={10000}
                  value={preferences.min_investment}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      min_investment: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Maximum Check Size ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min={10000}
                  step={25000}
                  value={preferences.max_investment}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      max_investment: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Preferred Business Models */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              4. Preferred Business Models
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Filter by how the startup captures revenue and monetizes its user base.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {availableBusinessModels.map((bm) => {
              const selected = preferences.preferred_business_models.includes(bm);
              return (
                <button
                  type="button"
                  key={bm}
                  onClick={() => toggleItem("preferred_business_models", bm)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    selected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500"
                      : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {selected && "✓ "}
                  {bm}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Geography */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              5. Geographic Mandate
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Region or jurisdictions where your LP agreement permits deployment.
            </p>
          </div>

          <div>
            <select
              value={preferences.geography}
              onChange={(e) => setPreferences({ ...preferences, geography: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="Global">Global Mandate (Any Jurisdiction)</option>
              <option value="North America">North America (US & Canada)</option>
              <option value="Europe">Europe (EU & UK)</option>
              <option value="Asia-Pacific">Asia-Pacific (APAC)</option>
              <option value="Latin America">Latin America (LATAM)</option>
            </select>
          </div>
        </div>

        {/* 6. Technology Preferences */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              6. Frontier Technology Interests
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Specific architectural or scientific breakthroughs of interest.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {availableTechs.map((tech) => {
              const selected = preferences.tech_preferences.includes(tech);
              return (
                <button
                  type="button"
                  key={tech}
                  onClick={() => toggleItem("tech_preferences", tech)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    selected
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/25 border border-amber-500"
                      : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {selected && "✓ "}
                  {tech}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-zinc-800">
          <Link
            href="/investor/dashboard"
            className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving Preferences..." : "Save Investment Criteria"}
          </button>
        </div>
      </form>
    </div>
  );
}
