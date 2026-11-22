"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bell, Bookmark, Check, MessagesSquare, Sparkles, Wallet } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ReasonLine } from "@/components/forms";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  FormFooter,
  LoadingRows,
  PageHeader,
  Section,
  Stat,
  Tag,
  Toggle,
  cx,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { stageLabel, stageTone } from "@/lib/dealroom";
import { formatMoney, timeAgo } from "@/lib/format";
import { formatCompact, formatSigned, gainTone } from "@/lib/money";
import { normalizeThesis, summarizeThesis } from "@/lib/thesis";
import type { DealFlow, DiscoverItem, NotificationItem, PortfolioSummary } from "@/types";

type Tab = "overview" | "notifications" | "profile" | "settings";

const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Your best fits, where your deals stand, and your portfolio at a glance." },
  notifications: { title: "Notifications", description: "Replies from founders and new matches." },
  profile: { title: "Profile", description: "What founders see about you when you request an intro." },
  settings: { title: "Settings", description: "Alerts and contact preferences." },
};
const TABS = Object.keys(TAB_COPY) as Tab[];

// Sections that moved out of this page keep working as links.
const MOVED: Record<string, string> = {
  recommended: "/investor/discover",
  browse: "/investor/discover",
  interests: "/investor/deal-flow",
};

function InvestorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = tabParam && (TABS as string[]).includes(tabParam) ? (tabParam as Tab) : "overview";

  useEffect(() => {
    if (tabParam && MOVED[tabParam]) router.replace(MOVED[tabParam]);
  }, [tabParam, router]);

  const [fits, setFits] = useState<DiscoverItem[] | null>(null);
  const [fitCount, setFitCount] = useState<number | null>(null);
  const [flow, setFlow] = useState<DealFlow | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [thesisLines, setThesisLines] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [profile, setProfile] = useState({
    name: "",
    firm: "",
    title: "",
    bio: "",
    location: "",
    thesis: "",
    minCheck: "",
    maxCheck: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [settings, setSettings] = useState({
    autoNotifyHighConviction: true,
    weeklyDealflowSummary: true,
    directFounderMessaging: true,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    const failed = (err: unknown) => mounted && setLoadError(err instanceof Error ? err.message : "Some of your data couldn't be loaded.");
    api
      .discover({ matched_only: true, sort: "fit", page_size: 4 })
      .then((page) => {
        if (!mounted) return;
        setFits(page.items);
        setFitCount(page.total);
      })
      .catch(failed);
    api.getDealFlow().then((d) => mounted && setFlow(d)).catch(failed);
    api.getPortfolioSummary().then((p) => mounted && setPortfolio(p)).catch(failed);
    api.getInvestorPreferences().then((p) => mounted && setThesisLines(p ? summarizeThesis(normalizeThesis(p.thesis)) : []));
    api.getNotifications("INVESTOR").then((data) => mounted && Array.isArray(data) && setNotifications(data));
    api.getInvestorProfile().then((data) => {
      if (mounted && data) {
        setProfile({
          name: data.name || "",
          firm: data.firm || "",
          title: data.title || "",
          bio: data.bio || "",
          location: data.location || "",
          thesis: data.thesis || "",
          minCheck: data.min_check || "",
          maxCheck: data.max_check || "",
        });
      }
    });
    api.getInvestorSettings().then((data) => {
      if (mounted && data) {
        setSettings({
          autoNotifyHighConviction: data.auto_notify_high_conviction ?? true,
          weeklyDealflowSummary: data.weekly_dealflow_summary ?? true,
          directFounderMessaging: data.direct_founder_messaging ?? true,
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string | number) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead("INVESTOR");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateInvestorProfile({
      name: profile.name,
      firm: profile.firm,
      title: profile.title,
      bio: profile.bio,
      location: profile.location,
      thesis: profile.thesis,
      min_check: profile.minCheck,
      max_check: profile.maxCheck,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateInvestorSettings({
      auto_notify_high_conviction: settings.autoNotifyHighConviction,
      weekly_dealflow_summary: settings.weeklyDealflowSummary,
      direct_founder_messaging: settings.directFounderMessaging,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const copy = TAB_COPY[activeTab];
  const counts = flow?.counts ?? {};
  const t = portfolio?.totals;

  return (
    <PortalLayout role="INVESTOR" activeItem={activeTab} title={copy.title}>
      <PageHeader
        title={activeTab === "overview" && profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : copy.title}
        description={copy.description}
        actions={
          activeTab === "notifications" && unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              <Check className="w-4 h-4" />
              Mark all as read
            </Button>
          ) : null
        }
      />

      {/* ---------------- Overview ---------------- */}
      {activeTab === "overview" && (
        <div className="space-y-10">
          {loadError && (
            <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              {loadError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Matches" value={fitCount ?? "—"} hint="Startups that fit your criteria" icon={Sparkles} />
            <Stat
              label="In your pipeline"
              value={flow ? (counts.saved ?? 0) + (counts.requested ?? 0) : "—"}
              hint={flow ? `${counts.saved ?? 0} saved · ${counts.requested ?? 0} requested` : undefined}
              icon={Bookmark}
            />
            <Stat label="Active deals" value={flow ? counts.active ?? 0 : "—"} hint="Open deal rooms" icon={MessagesSquare} />
            <Stat
              label="Portfolio value"
              value={t ? (t.active_count + t.exited_count + t.written_off_count ? formatCompact(t.current_value) : "—") : "—"}
              hint={t && t.active_count + t.exited_count + t.written_off_count ? `${formatCompact(t.total_invested)} invested` : "No investments recorded"}
              icon={Wallet}
            />
          </div>

          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-muted">Your thesis</div>
              <div className="mt-1 text-sm text-ink">
                {thesisLines == null ? "…" : thesisLines.length ? thesisLines.slice(0, 2).join(" ") : "Not set yet"}
              </div>
            </div>
            <ButtonLink href="/investor/preferences" variant="secondary" className="shrink-0">
              {thesisLines?.length ? "Edit criteria" : "Set criteria"}
            </ButtonLink>
          </Card>

          <Section
            title="Best fits for you"
            action={
              (fitCount ?? 0) > 4 && (
                <Link href="/investor/discover" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  See all {fitCount}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )
            }
          >
            {fits == null ? (
              loadError ? null : <LoadingRows />
            ) : fits.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No matches yet"
                description="Set your criteria and we'll rank published startups by how well they fit."
                action={<ButtonLink href="/investor/preferences">Set criteria</ButtonLink>}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {fits.map((f) => (
                  <Card key={f.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/investor/projects/${f.id}`} className="text-sm font-medium text-ink hover:underline">
                          {f.title}
                        </Link>
                        <div className="text-sm text-muted">
                          {f.stage} · {f.industry}
                        </div>
                      </div>
                      {f.match_score != null && (
                        <Tag tone={f.match_score >= 85 ? "positive" : "accent"}>{Math.round(f.match_score)}% fit</Tag>
                      )}
                    </div>
                    {f.reasons.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {/* The strongest met criteria first; a fit card never leads with a mismatch. */}
                        {[...f.reasons]
                          .sort((a, b) => (b.score ?? 100) - (a.score ?? 100))
                          .slice(0, 2)
                          .map((r) => (
                            <ReasonLine key={r.category} reason={r} />
                          ))}
                      </ul>
                    )}
                    <div className="mt-auto pt-4 text-sm">
                      <span className="text-muted">Raising </span>
                      <span className="font-medium tabular-nums text-ink">{formatMoney(f.funding_required)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              fill
              title="Recent deal activity"
              action={
                <Link href="/investor/deal-flow" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  Deal Flow
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {flow == null ? (
                loadError ? null : <LoadingRows />
              ) : flow.items.length === 0 ? (
                <EmptyState
                  compact
                  icon={MessagesSquare}
                  title="No deals yet"
                  description="Save startups or request intros from Discover to start your pipeline."
                  action={<ButtonLink href="/investor/discover" variant="secondary">Discover startups</ButtonLink>}
                />
              ) : (
                <Card padded={false} className="flex flex-col overflow-hidden">
                  <div className="divide-y divide-line">
                  {flow.items.slice(0, 5).map((d) => (
                    <div key={d.project_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{d.title}</div>
                        <div className="text-xs text-muted">{d.last_activity ? timeAgo(d.last_activity) : ""}</div>
                      </div>
                      {d.deal_stage && d.status === "active" ? (
                        <Tag tone={stageTone(d.deal_stage)}>{stageLabel(d.deal_stage)}</Tag>
                      ) : (
                        <Tag tone={d.status === "requested" ? "warning" : d.status === "closed" ? "positive" : "neutral"}>
                          {{ saved: "Saved", requested: "Requested", active: "In progress", closed: "Closed", declined: "Declined", passed: "Passed" }[d.status]}
                        </Tag>
                      )}
                    </div>
                  ))}
                  </div>
                  {/* Pipeline summary pinned to the bottom, so a short list never leaves a blank panel. */}
                  <div className="mt-auto border-t border-line bg-canvas/60 px-5 py-4">
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          ["saved", "Saved"],
                          ["requested", "Requested"],
                          ["active", "Active"],
                          ["closed", "Closed"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <div className="figure text-xl font-medium text-ink">{counts[key] ?? 0}</div>
                          <div className="text-xs text-muted">{label}</div>
                        </div>
                      ))}
                    </div>
                    {flow.items.length < 3 && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                        <span className="text-sm text-muted">Find more startups that fit your thesis.</span>
                        <ButtonLink href="/investor/discover" variant="secondary">
                          Discover startups
                        </ButtonLink>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </Section>

            <Section
              fill
              title="Portfolio"
              action={
                <Link href="/investor/portfolio" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  Portfolio & Finances
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {portfolio == null ? (
                loadError ? null : <LoadingRows />
              ) : portfolio.holdings.length === 0 ? (
                <EmptyState
                  compact
                  icon={Wallet}
                  title="No investments recorded"
                  description="Record the investments you've made to track their value and returns."
                  action={<ButtonLink href="/investor/portfolio?record=new" variant="secondary">Record an investment</ButtonLink>}
                />
              ) : (
                <Card className="flex flex-col">
                  <div className="grid grid-cols-2 gap-4 pb-5 text-sm">
                  <div>
                    <div className="text-muted">Invested</div>
                    <div className="figure mt-0.5 text-xl font-medium text-ink">{formatCompact(portfolio.totals.total_invested)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Current value</div>
                    <div className="figure mt-0.5 text-xl font-medium text-ink">{formatCompact(portfolio.totals.current_value)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Cash returned</div>
                    <div className="figure mt-0.5 text-xl font-medium text-ink">{formatCompact(portfolio.totals.cash_returned)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Net gain</div>
                    <div
                      className={cx(
                        "figure mt-0.5 text-xl font-medium",
                        gainTone(portfolio.totals.net_gain) === "positive" ? "text-positive" : gainTone(portfolio.totals.net_gain) === "danger" ? "text-danger" : "text-ink"
                      )}
                    >
                      {formatSigned(portfolio.totals.net_gain)}
                    </div>
                  </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <span className="text-sm text-muted">Unvalued holdings count at cost.</span>
                    <ButtonLink href="/investor/portfolio?record=new" variant="secondary">
                      Record investment
                    </ButtonLink>
                  </div>
                </Card>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ---------------- Notifications ---------------- */}
      {activeTab === "notifications" &&
        (notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" description="Founder replies and new matches will show up here." />
        ) : (
          <Card padded={false} className="max-w-3xl divide-y divide-line">
            {notifications.map((n) => (
              <div key={n.id} className="flex gap-3 px-5 py-4">
                <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cx("text-sm", n.read ? "text-ink-2" : "font-medium text-ink")}>{n.title}</span>
                    <span className="shrink-0 text-xs text-faint">{n.time || (n.created_at ? timeAgo(n.created_at) : "")}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{n.desc}</p>
                  <div className="mt-2 flex gap-3 text-sm">
                    {n.link && (
                      <Link href={n.link} className="font-medium text-accent hover:underline">
                        View
                      </Link>
                    )}
                    {!n.read && (
                      <button type="button" onClick={() => markRead(n.id)} className="text-muted hover:text-ink">
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ))}

      {/* ---------------- Profile ---------------- */}
      {activeTab === "profile" && (
        <Card className="max-w-2xl">
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="ip-name">
                <input id="ip-name" className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </Field>
              <Field label="Title" htmlFor="ip-title">
                <input id="ip-title" placeholder="e.g. Partner, Angel investor" className={inputClass} value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Firm or fund" htmlFor="ip-firm">
                <input id="ip-firm" className={inputClass} value={profile.firm} onChange={(e) => setProfile({ ...profile, firm: e.target.value })} />
              </Field>
              <Field label="Location" htmlFor="ip-location">
                <input id="ip-location" className={inputClass} value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </Field>
            </div>
            <Field label="Investment thesis" htmlFor="ip-thesis" hint="What you invest in and why, in a few lines.">
              <textarea id="ip-thesis" rows={3} className={inputClass} value={profile.thesis} onChange={(e) => setProfile({ ...profile, thesis: e.target.value })} />
            </Field>
            <Field label="About you" htmlFor="ip-bio">
              <textarea id="ip-bio" rows={2} className={inputClass} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Smallest check" htmlFor="ip-min">
                <input id="ip-min" placeholder="₹5,00,000" className={inputClass} value={profile.minCheck} onChange={(e) => setProfile({ ...profile, minCheck: e.target.value })} />
              </Field>
              <Field label="Largest check" htmlFor="ip-max">
                <input id="ip-max" placeholder="₹50,00,000" className={inputClass} value={profile.maxCheck} onChange={(e) => setProfile({ ...profile, maxCheck: e.target.value })} />
              </Field>
            </div>
            <FormFooter saved={profileSaved} label="Save profile" />
          </form>
        </Card>
      )}

      {/* ---------------- Settings ---------------- */}
      {activeTab === "settings" && (
        <Card className="max-w-2xl">
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="divide-y divide-line">
              <Toggle
                label="Notify me about strong fits"
                description="When a newly published startup closely fits your criteria."
                checked={settings.autoNotifyHighConviction}
                onChange={(v) => setSettings({ ...settings, autoNotifyHighConviction: v })}
              />
              <Toggle
                label="Weekly summary"
                description="A short weekly email with the best new fits."
                checked={settings.weeklyDealflowSummary}
                onChange={(v) => setSettings({ ...settings, weeklyDealflowSummary: v })}
              />
              <Toggle
                label="Allow founders to message me"
                description="Founders who accept your intro can message you in the deal room."
                checked={settings.directFounderMessaging}
                onChange={(v) => setSettings({ ...settings, directFounderMessaging: v })}
              />
            </div>
            <FormFooter saved={settingsSaved} label="Save settings" />
          </form>
        </Card>
      )}
    </PortalLayout>
  );
}

export default function InvestorDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <InvestorDashboardContent />
    </Suspense>
  );
}
