"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Handshake, Lock, Search, Sparkles } from "lucide-react";
import { buttonClass, cx, ScoreBar } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Project } from "@/types";

const STEPS = [
  {
    icon: FileText,
    title: "Add your startup",
    body: "Describe the problem, your solution and your raise. Upload your deck and link your GitHub repo if you have one.",
  },
  {
    icon: Sparkles,
    title: "Get honest feedback",
    body: "An AI review scores how ready you are to pitch and lists exactly what to fix. Only you see it.",
  },
  {
    icon: Handshake,
    title: "Meet the right investors",
    body: "Publish when you're ready. Investors whose criteria fit can request an intro, and you decide who to talk to.",
  },
];

const FOUNDER_POINTS = [
  "Private readiness score with specific things to improve",
  "Feedback that reads your deck, documents and code",
  "Stay hidden until you choose to publish",
  "Accept or decline every intro request",
];

const INVESTOR_POINTS = [
  "Startups ranked by fit with your thesis: sectors, stages, cheque size and geography",
  "A clear reason for every match, including what doesn't fit",
  "Save startups, request intros and follow every deal in one pipeline",
  "Track your portfolio's value and returns in rupees",
];

export default function HomePage() {
  // Only real, published startups are shown; the section stays hidden until there are some.
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let mounted = true;
    api.getProjects().then((data) => {
      if (mounted) setProjects(data.filter((p) => p.is_published !== false));
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="bg-surface">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-2">
        <div>
          <h1 className="text-[44px] font-medium leading-[1.08] text-ink sm:text-6xl">
            Get ready to raise.
            <br />
            Meet investors who fit.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            VentureX gives founders private, honest feedback on their pitch, then connects them with investors
            looking for exactly what they&apos;re building.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={buttonClass("primary", "px-5 py-2.5")}>
              I&apos;m a founder
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/register?role=investor" className={buttonClass("secondary", "px-5 py-2.5")}>
              I&apos;m an investor
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* A quiet preview of the readiness report (illustrative). */}
        <div className="rounded-2xl border border-line bg-canvas p-3 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted">Readiness</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-ink">72</span>
                  <span className="text-sm text-muted">/ 100</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" />
                Only you see this
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <ScoreBar label="Problem & solution" value={86} />
              <ScoreBar label="Market" value={64} />
              <ScoreBar label="Business model" value={71} />
              <ScoreBar label="Traction" value={48} />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <div className="text-sm font-medium text-ink">Fix before you publish</div>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                <li className="flex gap-2">
                  <span className="text-faint">1</span> Add pilot results or a waitlist number
                </li>
                <li className="flex gap-2">
                  <span className="text-faint">2</span> Size your market with a source
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-faint">Example report</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-medium text-ink sm:text-4xl">How it works</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface">
                  <step.icon className="h-5 w-5 text-accent" />
                </div>
                <div className="mt-4 text-sm text-faint">Step {i + 1}</div>
                <h3 className="mt-1 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For founders, then for investors: separate sections so each nav link lands on its own. */}
      <Audience
        id="founders"
        icon={FileText}
        eyebrow="For founders"
        title="Know where you stand before you pitch."
        lead="Get a private, honest read on your startup, fix what investors will question, and only talk to investors who fit."
        points={FOUNDER_POINTS}
        cta={{ href: "/register", label: "Create a founder account" }}
      />
      <Audience
        id="investors"
        icon={Search}
        eyebrow="For investors"
        title="See startups that fit your thesis."
        lead="Set what you invest in once. VentureX ranks every published startup against it and keeps your deals and portfolio in one place."
        points={INVESTOR_POINTS}
        cta={{ href: "/register?role=investor", label: "Create an investor account" }}
        reverse
      />

      {/* Published startups (real data only) */}
      {projects.length > 0 && (
        <section className="border-t border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-medium text-ink sm:text-4xl">Startups raising now</h2>
                <p className="mt-2 text-muted">Published by founders on VentureX.</p>
              </div>
              <Link href="/register?role=investor" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Sign up to request intros <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {projects.slice(0, 3).map((p) => (
                <div key={p.id} className="flex flex-col rounded-xl border border-line bg-surface p-5">
                  <div className="text-sm font-medium text-ink">{p.title}</div>
                  <div className="text-sm text-muted">
                    {p.stage} · {p.industry}
                  </div>
                  {(p.tagline || p.description) && (
                    <p className="mt-3 line-clamp-3 text-sm text-ink-2">{p.tagline || p.description}</p>
                  )}
                  <div className="mt-auto pt-4 text-sm">
                    <span className="text-muted">Raising </span>
                    <span className="font-medium text-ink">{formatMoney(p.funding_required)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Closing call to action */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-ink px-8 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-medium text-white">Start with an honest read on your pitch.</h2>
            <p className="mt-2 text-white/70">Free to try. Nothing is shared until you publish.</p>
          </div>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-white/90"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Audience({
  id,
  icon: Icon,
  eyebrow,
  title,
  lead,
  points,
  cta,
  reverse = false,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  lead: string;
  points: string[];
  cta: { href: string; label: string };
  reverse?: boolean;
}) {
  return (
    <section id={id} className={cx("scroll-mt-16 border-t border-line", reverse ? "bg-canvas" : "bg-surface")}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div className={cx(reverse && "md:order-2")}>
          <div className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            <Icon className="h-4 w-4" />
            {eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-medium leading-tight text-ink sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-md text-muted">{lead}</p>
          <Link href={cta.href} className={buttonClass("primary", "mt-8")}>
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className={cx("space-y-4 rounded-2xl border border-line bg-surface p-8 shadow-card", reverse && "md:order-1")}>
          {points.map((point) => (
            <li key={point} className="flex gap-3 text-ink-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
