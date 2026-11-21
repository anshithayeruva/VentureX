"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Mail,
  MessagesSquare,
  Rocket,
  Search,
  Sliders,
  Sparkles,
  User,
} from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
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
  Segmented,
  Stat,
  Tag,
  Toggle,
  buttonClass,
  cx,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/format";
import { InvestorPreference, MatchItem, NotificationItem, Project, ProjectInterest } from "@/types";

type Tab = "overview" | "recommended" | "browse" | "interests" | "notifications" | "profile" | "settings";
type Connection = "none" | "pending" | "accepted" | "declined";

const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Startups that fit your criteria and where your intro requests stand." },
  recommended: {
    title: "Recommended",
    description: "Published startups ranked by how well they fit your criteria, with the reasons.",
  },
  browse: { title: "Browse", description: "Every startup founders have published." },
  interests: {
    title: "My interests",
    description: "Intro requests you've sent. When a founder accepts, a private deal room opens.",
  },
  notifications: { title: "Notifications", description: "Replies from founders and new matches." },
  profile: { title: "Profile", description: "What founders see about you when you request an intro." },
  settings: { title: "Settings", description: "Alerts and contact preferences." },
};
const TABS = Object.keys(TAB_COPY) as Tab[];

function InvestorDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [interests, setInterests] = useState<ProjectInterest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<InvestorPreference | null>(null);

  const [industry, setIndustry] = useState("All");
  const [query, setQuery] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [interestFilter, setInterestFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");
  const [notice, setNotice] = useState<string | null>(null);

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
    Promise.all([
      api.getProjects().then((data) => mounted && setProjects(data)),
      api.getMatches().then((data) => mounted && setMatches(data)),
      api.getInterests().then((data) => mounted && Array.isArray(data) && setInterests(data)),
    ]).finally(() => mounted && setLoaded(true));
    api.getInvestorPreferences().then((data) => mounted && setPrefs(data));
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

  const projectById = useMemo(() => new Map(projects.map((p) => [String(p.id), p])), [projects]);
  // Only matches whose project is published and visible to this investor.
  const sortedMatches = useMemo(
    () =>
      matches.filter((m) => projectById.has(String(m.project_id))).sort((a, b) => b.match_score - a.match_score),
    [matches, projectById]
  );
  const industries = useMemo(
    () => ["All", ...Array.from(new Set(projects.map((p) => p.industry).filter(Boolean))).sort()],
    [projects]
  );
  const browseProjects = projects.filter((p) => {
    const q = query.trim().toLowerCase();
    const inIndustry = industry === "All" || p.industry === industry;
    const inSearch =
      !q || [p.title, p.tagline, p.description, p.industry].some((v) => v?.toLowerCase().includes(q));
    return inIndustry && inSearch;
  });
  const visibleInterests = interests.filter((i) => interestFilter === "all" || i.status === interestFilter);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingCount = interests.filter((i) => i.status === "pending").length;
  const acceptedCount = interests.filter((i) => i.status === "accepted").length;

  const connectionFor = (projectId: number | string): Connection => {
    const mine = interests.filter((i) => String(i.project_id) === String(projectId));
    if (mine.some((i) => i.status === "accepted")) return "accepted";
    if (mine.some((i) => i.status === "pending")) return "pending";
    if (mine.some((i) => i.status === "declined")) return "declined";
    return "none";
  };

  /* ---------- actions ---------- */

  const requestIntro = async (project: Project) => {
    setConnectingId(String(project.id));
    try {
      const created = await api.expressInterest({
        project_id: project.id,
        project_title: project.title,
        project_industry: project.industry,
        message: `Interested in learning more about ${project.title} and discussing the ${project.stage} round.`,
      });
      if (created) {
        setInterests((prev) => [created, ...prev.filter((i) => String(i.id) !== String(created.id))]);
        flash(`Intro requested for ${project.title}. You'll be notified when the founder replies.`);
      }
    } finally {
      setConnectingId(null);
    }
  };

  const withdraw = async (interest: ProjectInterest) => {
    await api.withdrawInterest(interest.id);
    setInterests((prev) => prev.filter((i) => String(i.id) !== String(interest.id)));
    flash(`Request for ${interest.project_title || "this project"} withdrawn.`);
  };

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };

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

  /* ---------- pieces ---------- */

  const introAction = (project: Project) => {
    const status = connectionFor(project.id);
    if (status === "accepted")
      return (
        <ButtonLink href="/investor/dashboard?tab=interests" variant="secondary">
          <MessagesSquare className="w-4 h-4" />
          Connected
        </ButtonLink>
      );
    if (status === "pending") return <Tag tone="warning">Intro requested</Tag>;
    if (status === "declined") return <Tag>Founder declined</Tag>;
    const busy = connectingId === String(project.id);
    return (
      <Button onClick={() => requestIntro(project)} disabled={busy}>
        {busy ? "Sending…" : "Request intro"}
      </Button>
    );
  };

  const projectCard = (project: Project, match?: MatchItem) => (
    <Card key={project.id} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/investor/projects/${project.id}`} className="text-sm font-medium text-ink hover:underline">
            {project.title}
          </Link>
          <div className="text-sm text-muted">
            {project.stage} · {project.industry}
          </div>
        </div>
        {match && <Tag tone={match.match_score >= 85 ? "positive" : "accent"}>{Math.round(match.match_score)}% fit</Tag>}
      </div>
      {(project.tagline || project.description) && (
        <p className="mt-3 text-sm text-ink-2 line-clamp-2">{project.tagline || project.description}</p>
      )}
      {match?.reasons?.length ? (
        <ul className="mt-3 space-y-1">
          {match.reasons.slice(0, 3).map((r) => (
            <li key={r.category} className="flex gap-2 text-sm text-muted">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
              <span className="line-clamp-2">{r.explanation}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="text-sm">
          <span className="text-muted">Raising </span>
          <span className="font-medium text-ink tabular-nums">{formatMoney(project.funding_required)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/investor/projects/${project.id}`} className={buttonClass("ghost")}>
            Details
          </Link>
          {introAction(project)}
        </div>
      </div>
    </Card>
  );

  const matchedCards = (list: MatchItem[]) =>
    list
      .map((m) => {
        const project = projectById.get(String(m.project_id));
        return project ? projectCard(project, m) : null;
      })
      .filter(Boolean);

  const copy = TAB_COPY[activeTab];
  const criteriaSummary = prefs
    ? [
        prefs.preferred_industries?.length ? prefs.preferred_industries.join(", ") : null,
        prefs.preferred_stages?.length ? prefs.preferred_stages.join(", ") : null,
        prefs.min_investment || prefs.max_investment
          ? `${formatMoney(prefs.min_investment)} – ${formatMoney(prefs.max_investment)}`
          : null,
      ].filter(Boolean)
    : [];

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
          ) : activeTab === "recommended" ? (
            <ButtonLink href="/investor/preferences" variant="secondary">
              <Sliders className="w-4 h-4" />
              Edit criteria
            </ButtonLink>
          ) : null
        }
      />

      {notice && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-lg bg-positive-soft px-4 py-3 text-sm text-positive">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* ---------------- Overview ---------------- */}
      {activeTab === "overview" && (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Matches" value={sortedMatches.length} hint={`${sortedMatches.filter((m) => m.match_score >= 85).length} strong fits`} icon={Sparkles} />
            <Stat label="Published startups" value={projects.length} hint="Open to intro requests" icon={Rocket} />
            <Stat label="Intros pending" value={pendingCount} hint="Waiting on founders" icon={Heart} />
            <Stat label="Deal rooms" value={acceptedCount} hint="Founders who accepted" icon={MessagesSquare} />
          </div>

          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-muted">Your criteria</div>
              <div className="mt-1 text-sm font-medium text-ink">
                {criteriaSummary.length ? criteriaSummary.join(" · ") : "Not set yet"}
              </div>
            </div>
            <ButtonLink href="/investor/preferences" variant="secondary" className="shrink-0">
              {criteriaSummary.length ? "Edit" : "Set criteria"}
            </ButtonLink>
          </Card>

          <Section title="Best fits for you" action={sortedMatches.length > 4 && <TabLink tab="recommended">See all</TabLink>}>
            {!loaded ? (
              <LoadingRows />
            ) : sortedMatches.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No matches yet"
                description="Set your criteria and we'll match you with published startups that fit."
                action={<ButtonLink href="/investor/preferences">Set criteria</ButtonLink>}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">{matchedCards(sortedMatches.slice(0, 4))}</div>
            )}
          </Section>
        </div>
      )}

      {/* ---------------- Recommended ---------------- */}
      {activeTab === "recommended" &&
        (!loaded ? (
          <LoadingRows />
        ) : sortedMatches.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No matches yet"
            description="Matches appear when published startups fit your industries, stages and check size."
            action={<ButtonLink href="/investor/preferences">Set criteria</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{matchedCards(sortedMatches)}</div>
        ))}

      {/* ---------------- Browse ---------------- */}
      {activeTab === "browse" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
              <input
                type="search"
                placeholder="Search startups"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cx(inputClass, "pl-9")}
              />
            </div>
            {industries.length > 2 && (
              <select
                aria-label="Filter by industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={cx(inputClass, "sm:w-56")}
              >
                {industries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind === "All" ? "All industries" : ind}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!loaded ? (
            <LoadingRows />
          ) : projects.length === 0 ? (
            <EmptyState icon={Rocket} title="No published startups yet" description="Check back soon." />
          ) : browseProjects.length === 0 ? (
            <EmptyState compact title="No startups match that search" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {browseProjects.map((p) => projectCard(p, matches.find((m) => String(m.project_id) === String(p.id))))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- My interests ---------------- */}
      {activeTab === "interests" && (
        <div className="space-y-5">
          {interests.length > 0 && (
            <Segmented
              value={interestFilter}
              onChange={setInterestFilter}
              options={[
                { value: "all", label: `All ${interests.length}` },
                { value: "pending", label: `Pending ${pendingCount}` },
                { value: "accepted", label: `Accepted ${acceptedCount}` },
                { value: "declined", label: `Declined ${interests.filter((i) => i.status === "declined").length}` },
              ]}
            />
          )}
          {!loaded ? (
            <LoadingRows />
          ) : interests.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No intro requests yet"
              description="Find a startup you like and request an intro. The founder decides whether to connect."
              action={<TabLink tab="browse" asButton>Browse startups</TabLink>}
            />
          ) : visibleInterests.length === 0 ? (
            <EmptyState compact title="Nothing here" />
          ) : (
            <div className="space-y-3">
              {visibleInterests.map((interest) => {
                const project = projectById.get(String(interest.project_id));
                const room = interest.deal_room;
                return (
                  <Card key={interest.id} className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/investor/projects/${interest.project_id}`}
                          className="text-sm font-medium text-ink hover:underline"
                        >
                          {interest.project_title || project?.title || `Project #${interest.project_id}`}
                        </Link>
                        <div className="text-sm text-muted">
                          {[project?.stage, interest.project_industry || project?.industry].filter(Boolean).join(" · ")}
                          {interest.created_at && <> · requested {timeAgo(interest.created_at)}</>}
                        </div>
                      </div>
                      <InterestStatus status={interest.status} />
                    </div>

                    {interest.status === "pending" && (
                      <div className="flex items-center justify-between gap-3 text-sm text-muted">
                        The founder hasn&apos;t replied yet.
                        <Button variant="ghost" onClick={() => withdraw(interest)}>
                          Withdraw
                        </Button>
                      </div>
                    )}

                    {interest.status === "accepted" && (
                      <div className="space-y-3">
                        {interest.response_note && (
                          <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink-2">
                            <span className="text-muted">Founder&apos;s note: </span>
                            {interest.response_note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <ButtonLink href={room?.room_id ? `/dealroom/${room.room_id}` : "/dealroom?role=INVESTOR"}>
                            <MessagesSquare className="w-4 h-4" />
                            Open deal room
                          </ButtonLink>
                          {interest.founder_email && (
                            <a href={`mailto:${interest.founder_email}`} className={buttonClass("secondary")}>
                              <Mail className="w-4 h-4" />
                              {interest.founder_email}
                            </a>
                          )}
                          {room?.pitch_deck_url && <ExternalButton href={room.pitch_deck_url} icon={FileText} label="Pitch deck" />}
                          {room?.founder_linkedin && <ExternalButton href={room.founder_linkedin} icon={User} label="LinkedIn" />}
                          {room?.founder_website && <ExternalButton href={room.founder_website} icon={Globe} label="Website" />}
                        </div>
                      </div>
                    )}

                    {interest.status === "declined" && (
                      <p className="text-sm text-muted">The founder decided not to connect this time.</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
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
                <input id="ip-min" placeholder="$50,000" className={inputClass} value={profile.minCheck} onChange={(e) => setProfile({ ...profile, minCheck: e.target.value })} />
              </Field>
              <Field label="Largest check" htmlFor="ip-max">
                <input id="ip-max" placeholder="$500,000" className={inputClass} value={profile.maxCheck} onChange={(e) => setProfile({ ...profile, maxCheck: e.target.value })} />
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

function TabLink({ tab, children, asButton = false }: { tab: Tab; children: React.ReactNode; asButton?: boolean }) {
  return (
    <Link
      href={`/investor/dashboard?tab=${tab}`}
      className={asButton ? buttonClass("primary") : "inline-flex items-center gap-1 font-medium text-accent hover:underline"}
    >
      {children}
      {!asButton && <ArrowRight className="w-3.5 h-3.5" />}
    </Link>
  );
}

function InterestStatus({ status }: { status: ProjectInterest["status"] }) {
  if (status === "accepted") return <Tag tone="positive">Accepted</Tag>;
  if (status === "declined") return <Tag>Declined</Tag>;
  return <Tag tone="warning">Waiting on founder</Tag>;
}

function ExternalButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
      <Icon className="w-4 h-4" />
      {label}
      <ExternalLink className="w-3.5 h-3.5 text-faint" />
    </a>
  );
}

export default function InvestorDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <InvestorDashboardContent />
    </Suspense>
  );
}
