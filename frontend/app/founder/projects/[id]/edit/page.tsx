"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Rocket,
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
import { api, MOCK_PROJECTS } from "@/lib/api";
import { Project, ProjectCreateInput } from "@/types";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const projectId = parseInt(resolvedParams.id, 10);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  useEffect(() => {
    const found = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
    if (found) {
      setFormData({
        title: found.title,
        tagline: found.tagline || "",
        description: found.description,
        problem: found.problem,
        solution: found.solution,
        industry: found.industry,
        stage: found.stage,
        funding_required: found.funding_required,
        business_model: found.business_model,
        target_market: found.target_market,
        website: found.website || "",
        pitch_deck_url: found.pitch_deck_url || "",
      });
    }
  }, [projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/founder/projects/${projectId}`);
      }, 1500);
    }, 600);
  };

  return (
    <PortalLayout role="FOUNDER" activeItem="projects" title={`Edit ${formData.title || "Project"}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href={`/founder/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Project Overview
        </Link>

        <div className="border-b border-[#E2E8F0] pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">Editing Venture</Badge>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#1B3B6F]" /> ID: #{projectId}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-display">
            Edit Project Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Update your startup narrative and dealflow parameters.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D52]" />
            Changes saved successfully! Returning to project overview...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#1B3B6F]" /> Startup Identity
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Startup Name <span className="text-[#1B3B6F]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1B3B6F] text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 shadow-subtle">
            <h2 className="text-base font-bold text-[#0F172A] font-display flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#2E7D52]" /> Sector & Raise
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Industry</label>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Stage</label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm"
                >
                  {stages.map((stg) => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Target Raise (USD)</label>
                <input
                  type="number"
                  value={formData.funding_required}
                  onChange={(e) => setFormData({ ...formData, funding_required: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
            <Link
              href={`/founder/projects/${projectId}`}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] shadow-sm transition-all"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
