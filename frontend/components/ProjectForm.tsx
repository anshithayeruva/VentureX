"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";
import { Card, Field, Toggle, buttonClass, cx, inputClass } from "@/components/ui";
import { ProjectCreateInput } from "@/types";

export const INDUSTRIES = [
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

export const STAGES = ["Idea Phase", "Prototype", "MVP / Private Beta", "Early Traction", "Pre-seed", "Seed", "Series A"];

export const BUSINESS_MODELS = [
  "B2B SaaS",
  "Enterprise Licensing",
  "Marketplace / Commission",
  "Usage-Based API",
  "Hardware + Recurring Software",
  "D2C Subscription",
];

export const EMPTY_PROJECT: ProjectCreateInput = {
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
  github_url: "",
  demo_url: "",
  country: "",
  city: "",
  monthly_revenue: null,
  customer_count: null,
  product_status: "",
};

const MAX_DECK_BYTES = 25 * 1024 * 1024;

export interface ProjectFormExtras {
  /** Create mode: publish straight away. */
  publish: boolean;
  /** Create mode: deck file uploaded privately after the project exists. */
  deck: File | null;
}

/**
 * The project form shared by "New project" and "Edit project".
 * Create mode adds a pitch-deck upload and a publish switch.
 */
export function ProjectForm({
  mode,
  initial,
  submitting,
  error,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: ProjectCreateInput;
  submitting: boolean;
  error?: string | null;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (data: ProjectCreateInput, extras: ProjectFormExtras) => void;
}) {
  const [data, setData] = useState<ProjectCreateInput>(initial);
  const [publish, setPublish] = useState(false);
  const [deck, setDeck] = useState<File | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);

  const set = <K extends keyof ProjectCreateInput>(key: K, value: ProjectCreateInput[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const text = (key: keyof ProjectCreateInput) => ({
    value: (data[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(data, { publish, deck });
      }}
      className="space-y-6"
    >
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <FormSection title="Basics" description="How your startup appears to investors once you publish.">
        <Field label="Startup name" htmlFor="pf-title">
          <input id="pf-title" required className={inputClass} placeholder="e.g. PharmaClaim" {...text("title")} />
        </Field>
        <Field label="One-line pitch" htmlFor="pf-tagline" hint="A single sentence on what you do.">
          <input id="pf-tagline" className={inputClass} placeholder="e.g. Stop insurance claim rejections before they happen" {...text("tagline")} />
        </Field>
        <Field label="Summary" htmlFor="pf-description">
          <textarea id="pf-description" required rows={4} className={inputClass} placeholder="What you're building, who it's for and where it's going." {...text("description")} />
        </Field>
      </FormSection>

      <FormSection title="Problem and solution" description="Be specific. Numbers and evidence make the biggest difference.">
        <Field label="The problem" htmlFor="pf-problem">
          <textarea id="pf-problem" required rows={3} className={inputClass} placeholder="Who has this problem, how painful is it, and why don't existing options solve it?" {...text("problem")} />
        </Field>
        <Field label="Your solution" htmlFor="pf-solution">
          <textarea id="pf-solution" required rows={3} className={inputClass} placeholder="How you solve it and what makes your approach hard to copy." {...text("solution")} />
        </Field>
      </FormSection>

      <FormSection title="The raise">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Industry" htmlFor="pf-industry">
            <select id="pf-industry" className={inputClass} value={data.industry} onChange={(e) => set("industry", e.target.value)}>
              {withCurrent(INDUSTRIES, data.industry).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Stage" htmlFor="pf-stage">
            <select id="pf-stage" className={inputClass} value={data.stage} onChange={(e) => set("stage", e.target.value)}>
              {withCurrent(STAGES, data.stage).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Raising (₹)" htmlFor="pf-funding">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-2 text-sm text-faint">₹</span>
              <input
                id="pf-funding"
                type="number"
                required
                min={0}
                step={1000}
                className={cx(inputClass, "pl-7")}
                value={data.funding_required}
                onChange={(e) => set("funding_required", Number(e.target.value))}
              />
            </div>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Business model" htmlFor="pf-model">
            <select id="pf-model" className={inputClass} value={data.business_model} onChange={(e) => set("business_model", e.target.value)}>
              {withCurrent(BUSINESS_MODELS, data.business_model).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Target customer" htmlFor="pf-market">
              <input id="pf-market" required className={inputClass} placeholder="e.g. Independent pharmacies in tier-2 cities" {...text("target_market")} />
            </Field>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Location and traction"
        description="Optional. Investors can filter on these. Leave blank anything you'd rather not share yet."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Country" htmlFor="pf-country">
            <input id="pf-country" maxLength={80} className={inputClass} placeholder="e.g. India" {...text("country")} />
          </Field>
          <Field label="City" htmlFor="pf-city">
            <input id="pf-city" maxLength={80} className={inputClass} placeholder="e.g. Bengaluru" {...text("city")} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Monthly revenue (₹)" htmlFor="pf-revenue">
            <input
              id="pf-revenue"
              type="number"
              min={0}
              step="any"
              className={inputClass}
              value={data.monthly_revenue ?? ""}
              onChange={(e) => set("monthly_revenue", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Paying customers" htmlFor="pf-customers">
            <input
              id="pf-customers"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={data.customer_count ?? ""}
              onChange={(e) => set("customer_count", e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))}
            />
          </Field>
          <Field label="Product status" htmlFor="pf-status">
            <select id="pf-status" className={inputClass} value={data.product_status ?? ""} onChange={(e) => set("product_status", e.target.value)}>
              <option value="">Not specified</option>
              <option value="idea">Idea</option>
              <option value="prototype">Prototype</option>
              <option value="beta">In beta</option>
              <option value="launched">Launched</option>
              <option value="scaling">Scaling</option>
            </select>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={mode === "create" ? "Pitch deck and links" : "Links"}
        description="The AI review reads your deck and public GitHub repo. Everything stays private until you publish."
      >
        {mode === "create" && (
          <div>
            <input
              id="pf-deck"
              type="file"
              accept=".pdf,.pptx,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_DECK_BYTES) {
                  setDeckError("The pitch deck must be 25 MB or smaller.");
                  return;
                }
                setDeckError(null);
                setDeck(file);
              }}
            />
            <label
              htmlFor="pf-deck"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 hover:bg-canvas"
            >
              {deck ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-positive" />
              ) : (
                <Upload className="h-5 w-5 shrink-0 text-faint" />
              )}
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium text-ink">{deck ? deck.name : "Upload your pitch deck"}</span>
                <span className="block text-muted">
                  {deck ? `${Math.round(deck.size / 1024)} KB · click to replace` : "PDF, PPTX or DOCX, up to 25 MB. Optional."}
                </span>
              </span>
            </label>
            {deckError && <p className="mt-1.5 text-sm text-danger">{deckError}</p>}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website" htmlFor="pf-website">
            <input id="pf-website" type="url" className={inputClass} placeholder="https://" {...text("website")} />
          </Field>
          <Field label="Deck link" htmlFor="pf-decklink" hint="If your deck lives on DocSend, Drive or similar.">
            <input id="pf-decklink" type="url" className={inputClass} placeholder="https://" {...text("pitch_deck_url")} />
          </Field>
          <Field label="GitHub repository" htmlFor="pf-github" hint="Public repos are read during the review.">
            <input id="pf-github" type="url" className={inputClass} placeholder="https://github.com/you/repo" {...text("github_url")} />
          </Field>
          <Field label="Demo link" htmlFor="pf-demo">
            <input id="pf-demo" type="url" className={inputClass} placeholder="Video or live product" {...text("demo_url")} />
          </Field>
        </div>
      </FormSection>

      {mode === "create" && (
        <Card>
          <Toggle
            label="Publish to investors now"
            description="Leave this off to keep the project private while you review your readiness feedback."
            checked={publish}
            onChange={setPublish}
          />
        </Card>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
        <Link href={cancelHref} className={buttonClass("ghost")}>
          Cancel
        </Link>
        <button type="submit" disabled={submitting} className={buttonClass("primary")}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Keep a saved value selectable even if it is no longer in the option list. */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}
