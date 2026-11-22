"use client";

import React, { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { BUSINESS_MODELS, INDUSTRIES, STAGES } from "@/components/ProjectForm";
import { Card, EmptyState, Field, LoadingRows, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { InvestorPreference } from "@/types";

// Same option lists founders choose from, so a criterion can actually match a project.
const INVESTOR_STAGES = [...STAGES, "Series B"];
const TECH = [
  "Generative AI & LLMs",
  "Edge Machine Learning",
  "Computer Vision",
  "Bioinformatics",
  "Autonomous Robotics",
  "Post-Quantum Cryptography",
];

type ListKey = "preferred_industries" | "preferred_stages" | "preferred_business_models" | "tech_preferences";

export default function InvestorPreferencesPage() {
  const [prefs, setPrefs] = useState<InvestorPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getInvestorPreferences().then((data) => {
      if (!mounted) return;
      setPrefs(data);
      setLoadFailed(data === null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = (key: ListKey, value: string) =>
    setPrefs((prev) => {
      if (!prev) return prev;
      const list = prev[key] || [];
      return { ...prev, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    if (prefs.max_investment && prefs.min_investment > prefs.max_investment) {
      setError("The smallest check can't be larger than the largest.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateInvestorPreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your criteria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout role="INVESTOR" activeItem="preferences" title="Criteria">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Investment criteria"
          description="Tell us what you invest in. We match you with published startups that fit."
        />
        {loadFailed ? (
          <EmptyState
            title="Couldn't load your criteria"
            description="Check your connection and refresh the page. Nothing has been changed."
          />
        ) : !prefs ? (
          <LoadingRows />
        ) : (
          <form onSubmit={save} className="space-y-6">
            <ChipSection
              title="Industries"
              options={withSaved(INDUSTRIES, prefs.preferred_industries)}
              selected={prefs.preferred_industries}
              onToggle={(v) => toggle("preferred_industries", v)}
            />
            <ChipSection
              title="Stages"
              options={withSaved(INVESTOR_STAGES, prefs.preferred_stages)}
              selected={prefs.preferred_stages}
              onToggle={(v) => toggle("preferred_stages", v)}
            />

            <Card className="space-y-5">
              <h2 className="text-base font-semibold text-ink">Check size</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <MoneyField
                  id="min-check"
                  label="Smallest check"
                  value={prefs.min_investment}
                  onChange={(v) => setPrefs({ ...prefs, min_investment: v })}
                />
                <MoneyField
                  id="max-check"
                  label="Largest check"
                  value={prefs.max_investment}
                  onChange={(v) => setPrefs({ ...prefs, max_investment: v })}
                />
              </div>
            </Card>

            <ChipSection
              title="Business models"
              description="Optional."
              options={withSaved(BUSINESS_MODELS, prefs.preferred_business_models)}
              selected={prefs.preferred_business_models}
              onToggle={(v) => toggle("preferred_business_models", v)}
            />
            <ChipSection
              title="Technologies"
              description="Optional."
              options={withSaved(TECH, prefs.tech_preferences)}
              selected={prefs.tech_preferences}
              onToggle={(v) => toggle("tech_preferences", v)}
            />

            <Card>
              <Field label="Geography" htmlFor="geo" hint="Optional. For example: North America, Europe, or anywhere.">
                <input
                  id="geo"
                  className={inputClass}
                  value={prefs.geography || ""}
                  onChange={(e) => setPrefs({ ...prefs, geography: e.target.value })}
                />
              </Field>
            </Card>

            {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

            <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-positive">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved. Your matches are updated.
                </span>
              )}
              <button type="submit" disabled={saving} className={buttonClass("primary")}>
                {saving ? "Saving…" : "Save criteria"}
              </button>
            </div>
          </form>
        )}
      </div>
    </PortalLayout>
  );
}

function ChipSection({
  title,
  description,
  options,
  selected,
  onToggle,
}: {
  title: string;
  description?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="text-sm text-muted">{description ?? (selected.length ? `${selected.length} selected` : "Pick any")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-ink-2 hover:bg-canvas"
              )}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {option}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-2 text-sm text-faint">$</span>
        <input
          id={id}
          type="number"
          min={0}
          step={1000}
          className={cx(inputClass, "pl-7")}
          value={value || 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    </Field>
  );
}

/** Keep previously saved values visible even if they're not in the standard list. */
function withSaved(options: string[], saved: string[] = []): string[] {
  return [...options, ...saved.filter((v) => !options.includes(v))];
}
