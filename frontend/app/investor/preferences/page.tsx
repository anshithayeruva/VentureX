"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Layers,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { PortalLayout } from "@/components/PortalLayout";
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
    <PortalLayout role="INVESTOR" activeItem="preferences" title="Investment Criteria">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/investor/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dealflow Dashboard
        </Link>

        {/* Header */}
        <div className="border-b border-[#E2E8F0] pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success">Investment Mandate</Badge>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D52]" /> Vector Cosine Indexing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
            Investment Matching Criteria
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Configure your thesis parameters. Venture X indexes incoming founder projects against your
            target sectors, ticket sizes, and stages for high-precision semantic matching.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-xl bg-[#E8F5E9] border border-[#A3E635] text-[#2E7D52] text-xs sm:text-sm flex items-center justify-between shadow-subtle">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2E7D52]" />
              <span>Investment criteria saved! Embeddings updated for semantic dealflow.</span>
            </div>
            <button
              onClick={() => router.push("/investor/dashboard")}
              className="text-xs font-bold text-[#0F172A] hover:text-[#1B3B6F] underline"
            >
              View Deals →
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Target Industries */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-3.5 shadow-subtle">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-display">
                  1. Target Industry Sectors
                </h2>
                <p className="text-xs text-[#64748B]">Select industries your fund actively deploys capital into.</p>
              </div>
              <Badge variant="secondary">
                {preferences.preferred_industries.length} Selected
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {availableIndustries.map((ind) => {
                const isSelected = preferences.preferred_industries.includes(ind);
                return (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleItem("preferred_industries", ind)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#1B3B6F] text-white shadow-sm"
                        : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                    }`}
                  >
                    {ind}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Stages & Check Size */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-display">
              2. Stage & Target Ticket Bracket
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-2">Stage Focus</label>
              <div className="flex flex-wrap gap-2">
                {availableStages.map((stg) => {
                  const isSelected = preferences.preferred_stages.includes(stg);
                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => toggleItem("preferred_stages", stg)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#1B3B6F] text-white shadow-sm"
                          : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                      }`}
                    >
                      {stg}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E2E8F0]">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Minimum Check Size (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#64748B] text-sm">$</span>
                  <input
                    type="number"
                    step={25000}
                    value={preferences.min_investment}
                    onChange={(e) =>
                      setPreferences({ ...preferences, min_investment: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Maximum Check Size (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#64748B] text-sm">$</span>
                  <input
                    type="number"
                    step={50000}
                    value={preferences.max_investment}
                    onChange={(e) =>
                      setPreferences({ ...preferences, max_investment: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business Models & Technology Focus */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-display">
              3. Business Model & Architecture
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-2">Preferred Business Models</label>
              <div className="flex flex-wrap gap-2">
                {availableBusinessModels.map((bm) => {
                  const isSelected = preferences.preferred_business_models.includes(bm);
                  return (
                    <button
                      key={bm}
                      type="button"
                      onClick={() => toggleItem("preferred_business_models", bm)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#1B3B6F] text-white shadow-sm"
                          : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                      }`}
                    >
                      {bm}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0]">
              <label className="block text-xs font-semibold text-[#0F172A] mb-2">Core Tech Paradigms</label>
              <div className="flex flex-wrap gap-2">
                {availableTechs.map((tech) => {
                  const isSelected = preferences.tech_preferences.includes(tech);
                  return (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => toggleItem("tech_preferences", tech)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#1B3B6F] text-white shadow-sm"
                          : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                      }`}
                    >
                      {tech}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Geographic Mandate */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-3 shadow-subtle">
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] font-display">
              4. Geographic Scope
            </h2>
            <input
              type="text"
              value={preferences.geography}
              onChange={(e) => setPreferences({ ...preferences, geography: e.target.value })}
              placeholder="e.g., North America, Europe, or Global Remote"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#1B3B6F]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
            <Link
              href="/investor/dashboard"
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {loading ? "Vectorizing Filters..." : "Save Mandate Preferences"}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
