"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Check,
  Download,
  Eye,
  Lock,
  Mail,
  MessagesSquare,
  Plus,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ReasonLine } from "@/components/forms";
import { ProjectIntelligence } from "@/components/ProjectIntelligence";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  FormFooter,
  LoadingRows,
  Segmented,
  Toggle,
  PageHeader,
  ScoreBar,
  Section,
  Stat,
  Tag,
  buttonClass,
  cx,
  inputClass,
} from "@/components/ui";
import { VerifiedBadge } from "@/components/verification";
import { api } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/format";
import { MatchItem, NotificationItem, PASS_REASON_LABEL, Project, ProjectInterest } from "@/types";

type Tab = "overview" | "projects" | "readiness" | "investors" | "intros" | "notifications" | "profile" | "settings";

const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Your projects, investor interest and what needs a reply." },
  projects: { title: "Projects", description: "Projects stay private until you publish them to investors." },
  readiness: {
    title: "Readiness",
    description: "AI feedback on how ready a project is to pitch. Only you can see this.",
  },
  investors: {
    title: "Investors",
    description: "Investors whose criteria fit your published projects, and why they match.",
  },
  intros: {
    title: "Intro requests",
    description: "Investors asking to connect with you, and the requests you've sent. Every yes opens a private deal room.",
  },
  notifications: { title: "Notifications", description: "Recent activity on your projects." },
  profile: { title: "Profile", description: "What investors see about you once you accept an intro." },
  settings: { title: "Settings", description: "Privacy defaults and alerts." },
};

const TABS = Object.keys(TAB_COPY) as Tab[];

function FounderDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview";

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [interests, setInterests] = useState<ProjectInterest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [statusProcessing, setStatusProcessing] = useState<string | null>(null);
  const [introFilter, setIntroFilter] = useState<"received" | "sent">("received");
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [readinessProjectId, setReadinessProjectId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const [profile, setProfile] = useState({ name: "", company: "", bio: "", location: "", linkedin: "", website: "" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [settings, setSettings] = useState({
    defaultPrivate: true,
    hideGapsFromInvestors: true,
    emailAlerts: true,
    weeklyDigest: false,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "investors") router.replace("/founder/investors");
  }, [activeTab, router]);

  useEffect(() => {
    let mounted = true;
    api
      .getProjects(true)
      .then((data) => mounted && setProjects(data))
      .finally(() => mounted && setProjectsLoaded(true));
    api.getMatches().then((data) => mounted && setMatches(data));
    api.getInterests().then((data) => mounted && Array.isArray(data) && setInterests(data));
    api.getFounderProfile().then((data) => {
      if (mounted && data) {
        setProfile({
          name: data.name || "",
          company: data.company || "",
          bio: data.bio || "",
          location: data.location || "",
          linkedin: data.linkedin || "",
          website: data.website || "",
        });
      }
    });
    api.getFounderSettings().then((data) => {
      if (mounted && data) {
        setSettings({
          defaultPrivate: data.default_private ?? true,
          hideGapsFromInvestors: data.hide_gaps_from_investors ?? true,
          emailAlerts: data.email_alerts ?? true,
          weeklyDigest: data.weekly_digest ?? false,
        });
      }
    });
    api.getNotifications("FOUNDER").then((data) => mounted && Array.isArray(data) && setNotifications(data));
    return () => {
      mounted = false;
    };
  }, []);

  const received = interests.filter((i) => i.initiated_by !== "founder");
  const sent = interests.filter((i) => i.initiated_by === "founder");
  const pending = received.filter((i) => i.status === "pending");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const scored = projects.filter((p) => typeof p.readiness_score === "number");
  const bestReadiness = scored.length ? Math.max(...scored.map((p) => p.readiness_score as number)) : null;
  const readinessProject = projects.find((p) => p.id === readinessProjectId) ?? projects[0] ?? null;

  const visibleIntros = introFilter === "sent" ? sent : received;

  /* ---------- actions ---------- */

  const withdrawIntro = async (interestId: string | number) => {
    setStatusProcessing(String(interestId));
    try {
      if (await api.withdrawInterest(interestId)) setInterests((prev) => prev.filter((i) => String(i.id) !== String(interestId)));
    } finally {
      setStatusProcessing(null);
    }
  };

  const updateIntro = async (interestId: string | number, status: "accepted" | "declined") => {
    setStatusProcessing(String(interestId));
    try {
      const res = await api.updateInterestStatus(interestId, status, responseNotes[String(interestId)]);
      if (res) {
        setInterests((prev) =>
          prev.map((item) => (String(item.id) === String(interestId) ? { ...item, ...res, status } : item))
        );
      }
    } finally {
      setStatusProcessing(null);
    }
  };

  const togglePublish = async (project: Project) => {
    const next = !project.is_published;
    const setPublished = (value: boolean) =>
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_published: value } : p)));
    setPublished(next);
    try {
      await api.togglePublishProject(project.id, next);
    } catch (err) {
      setPublished(!next);
      window.alert(err instanceof Error ? err.message : "Couldn't change the project's visibility.");
    }
  };

  const markRead = async (id: string | number) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead("FOUNDER");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateFounderProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateFounderSettings({
      default_private: settings.defaultPrivate,
      hide_gaps_from_investors: settings.hideGapsFromInvestors,
      email_alerts: settings.emailAlerts,
      weekly_digest: settings.weeklyDigest,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const exportReport = async () => {
    if (!readinessProject) return;
    setExporting(true);
    try {
      await api.downloadProjectReadinessPDF(readinessProject.id, readinessProject.title);
    } finally {
      setExporting(false);
    }
  };

  /* ---------- shared pieces ---------- */

  const noProjects = (
    <EmptyState
      icon={Rocket}
      title="No projects yet"
      description="Add your startup to get AI feedback on your pitch and get matched with investors."
      action={
        <ButtonLink href="/founder/projects/new">
          <Plus className="w-4 h-4" />
          New project
        </ButtonLink>
      }
    />
  );

  const sentRow = (item: ProjectInterest) => {
    const busy = statusProcessing === String(item.id);
    return (
      <Card key={item.id} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={item.investor_name} />
            <div className="min-w-0">
              <Link href={`/founder/investors/${encodeURIComponent(String(item.investor_id))}?project=${item.project_id}`} className="text-sm font-medium text-ink hover:underline">
                {item.investor_name || "Investor"}
                {item.investor_firm && <span className="font-normal text-muted"> · {item.investor_firm}</span>}
              </Link>
              <div className="text-sm text-muted">
                You asked about <span className="text-ink-2">{item.project_title || "your project"}</span>
                {item.created_at && <> · {timeAgo(item.created_at)}</>}
              </div>
            </div>
          </div>
          <SentStatus item={item} />
        </div>
        {item.status === "declined" && (
          <div className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink-2">
            <span className="font-medium">Reason:</span> {item.pass_reason ? PASS_REASON_LABEL[item.pass_reason] : "Not given"}
            {item.response_note && <span className="text-muted"> · “{item.response_note}”</span>}
          </div>
        )}
        {item.status === "expired" && (
          <p className="text-sm text-muted">No reply within 14 days. You can ask again 30 days after it expired.</p>
        )}
        {item.status === "accepted" && (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={item.deal_room?.room_id ? `/dealroom/${item.deal_room.room_id}` : "/dealroom?role=FOUNDER"}>
              <MessagesSquare className="w-4 h-4" />
              Open deal room
            </ButtonLink>
            {item.investor_email && (
              <a href={`mailto:${item.investor_email}`} className={buttonClass("secondary")}>
                <Mail className="w-4 h-4" />
                {item.investor_email}
              </a>
            )}
          </div>
        )}
        {item.status === "pending" && (
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <span className="line-clamp-1">“{item.message}”</span>
            <Button variant="ghost" disabled={busy} onClick={() => withdrawIntro(item.id)}>
              {busy ? "Withdrawing…" : "Withdraw"}
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const introRow = (item: ProjectInterest, compact = false) => {
    const busy = statusProcessing === String(item.id);
    return (
      <Card key={item.id} className={compact ? "" : "space-y-4"}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={item.investor_name} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">
                {item.investor_name || "Investor"}
                {item.investor_firm && <span className="font-normal text-muted"> · {item.investor_firm}</span>}
              </div>
              {item.investor_verified && <VerifiedBadge kind="investor" className="mb-1" />}
              <div className="text-sm text-muted">
                Wants to connect about <span className="text-ink-2">{item.project_title || "your project"}</span>
                {item.created_at && <> · {timeAgo(item.created_at)}</>}
              </div>
            </div>
          </div>
          {compact && item.status === "pending" ? (
            <div className="flex gap-2 shrink-0">
              <Button disabled={busy} onClick={() => updateIntro(item.id, "accepted")}>
                <Check className="w-4 h-4" />
                {busy ? "Saving…" : "Accept"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => updateIntro(item.id, "declined")}>
                Decline
              </Button>
            </div>
          ) : (
            <IntroStatus status={item.status} />
          )}
        </div>

        {item.message && !compact && (
          <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink-2">{item.message}</p>
        )}

        {item.status === "pending" && !compact && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Add a note for the investor (optional)"
              value={responseNotes[String(item.id)] || ""}
              onChange={(e) => setResponseNotes({ ...responseNotes, [String(item.id)]: e.target.value })}
              className={cx(inputClass, "sm:flex-1")}
            />
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => updateIntro(item.id, "accepted")}>
                <Check className="w-4 h-4" />
                {busy ? "Saving…" : "Accept"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => updateIntro(item.id, "declined")}>
                Decline
              </Button>
            </div>
          </div>
        )}

        {item.status === "accepted" && !compact && (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={item.deal_room?.room_id ? `/dealroom/${item.deal_room.room_id}` : "/dealroom?role=FOUNDER"}>
              <MessagesSquare className="w-4 h-4" />
              Open deal room
            </ButtonLink>
            {item.investor_email && (
              <a href={`mailto:${item.investor_email}`} className={buttonClass("secondary")}>
                <Mail className="w-4 h-4" />
                {item.investor_email}
              </a>
            )}
            {item.response_note && <span className="text-sm text-muted">Your note: “{item.response_note}”</span>}
          </div>
        )}

        {item.status === "declined" && !compact && (
          <div className="flex items-center justify-between text-sm text-muted">
            You declined this request.
            <Button variant="ghost" disabled={busy} onClick={() => updateIntro(item.id, "accepted")}>
              Accept instead
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const matchRow = (m: MatchItem) => (
    <Card key={m.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar name={m.investor_name} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">{m.investor_name}</div>
            <div className="text-sm text-muted truncate">
              {m.investor_firm || "Independent investor"} · for {m.project_title}
            </div>
          </div>
        </div>
        <Tag tone={m.match_score >= 85 ? "positive" : "accent"}>{Math.round(m.match_score)}% match</Tag>
      </div>
      {m.reasons?.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {m.reasons.slice(0, 4).map((r) => (
            <ReasonLine key={r.category} reason={{ ...r, explanation: `${r.category}: ${r.explanation}` }} />
          ))}
        </ul>
      )}
    </Card>
  );

  const copy = TAB_COPY[activeTab];

  return (
    <PortalLayout role="FOUNDER" activeItem={activeTab} title={copy.title}>
      <PageHeader
        title={activeTab === "overview" && profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : copy.title}
        description={copy.description}
        actions={
          activeTab === "readiness" && readinessProject ? (
            <Button variant="secondary" onClick={exportReport} disabled={exporting}>
              <Download className="w-4 h-4" />
              {exporting ? "Preparing PDF…" : "Export PDF"}
            </Button>
          ) : activeTab === "notifications" && unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              <Check className="w-4 h-4" />
              Mark all as read
            </Button>
          ) : (activeTab === "overview" || activeTab === "projects") && projects.length > 0 ? (
            <ButtonLink href="/founder/projects/new">
              <Plus className="w-4 h-4" />
              New project
            </ButtonLink>
          ) : null
        }
      />

      {/* ---------------- Overview ---------------- */}
      {activeTab === "overview" && (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Projects" value={projects.length} hint={`${projects.filter((p) => p.is_published).length} published`} icon={Rocket} />
            <Stat
              label="Best readiness"
              value={bestReadiness != null ? Math.round(bestReadiness) : "—"}
              hint={bestReadiness == null ? "Run an analysis" : readinessWord(bestReadiness)}
              icon={Sparkles}
            />
            <Stat label="Investor matches" value={matches.length} hint={`${matches.filter((m) => m.match_score >= 85).length} strong`} icon={Users} />
            <Stat label="Pending intros" value={pending.length} hint={pending.length ? "Waiting for your reply" : "All answered"} icon={Briefcase} />
          </div>

          {pending.length > 0 && (
            <Section
              title="Needs your reply"
              action={<TabLink tab="intros">All requests</TabLink>}
            >
              <div className="space-y-3">{pending.slice(0, 3).map((item) => introRow(item, true))}</div>
            </Section>
          )}

          <Section title="Your projects" action={projects.length > 0 && <TabLink tab="projects">Manage</TabLink>}>
            {!projectsLoaded ? (
              <LoadingRows />
            ) : projects.length === 0 ? (
              noProjects
            ) : (
              <Card padded={false} className="divide-y divide-line">
                {projects.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/founder/projects/${p.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{p.title}</div>
                      <div className="text-sm text-muted truncate">
                        {p.stage} · {p.industry} · raising {formatMoney(p.funding_required)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="hidden text-sm text-muted sm:inline tabular-nums">
                        {p.readiness_score != null ? `Readiness ${Math.round(p.readiness_score)}` : "Not analysed"}
                      </span>
                      <VisibilityTag published={!!p.is_published} />
                      {p.is_owner === false && <Tag>Co-founder</Tag>}
                    </div>
                  </Link>
                ))}
              </Card>
            )}
          </Section>

          {matches.length > 0 && (
            <Section
              title="Top investor matches"
              action={
                <Link href="/founder/investors" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  Find investors
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">{matches.slice(0, 4).map(matchRow)}</div>
            </Section>
          )}
        </div>
      )}

      {/* ---------------- Projects ---------------- */}
      {activeTab === "projects" &&
        (!projectsLoaded ? (
          <LoadingRows />
        ) : projects.length === 0 ? (
          noProjects
        ) : (
          <Card padded={false} className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Raising</th>
                  <th className="px-5 py-3 font-medium">Readiness</th>
                  <th className="px-5 py-3 font-medium">Visibility</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        {p.title}
                        {p.is_owner === false && <Tag>Co-founder</Tag>}
                      </div>
                      <div className="text-muted">
                        {p.stage} · {p.industry}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink-2 tabular-nums">{formatMoney(p.funding_required)}</td>
                    <td className="px-5 py-4 w-40">
                      {p.readiness_score != null ? (
                        <ScoreBar value={p.readiness_score} />
                      ) : (
                        <span className="text-muted">Not analysed</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => togglePublish(p)}
                        title={p.is_published ? "Make private" : "Publish to investors"}
                        className="rounded-md hover:opacity-80"
                      >
                        <VisibilityTag published={!!p.is_published} />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Link href={`/founder/projects/${p.id}/edit`} className={buttonClass("ghost")}>
                        Edit
                      </Link>
                      <Link href={`/founder/projects/${p.id}`} className={buttonClass("secondary", "ml-1")}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

      {/* ---------------- Readiness ---------------- */}
      {activeTab === "readiness" &&
        (!projectsLoaded ? (
          <LoadingRows />
        ) : !readinessProject ? (
          noProjects
        ) : (
          <div className="space-y-6">
            {projects.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReadinessProjectId(p.id)}
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      p.id === readinessProject.id
                        ? "border-accent bg-accent-soft text-accent font-medium"
                        : "border-line text-muted hover:text-ink hover:bg-canvas"
                    )}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted">
              <Lock className="w-4 h-4" />
              Investors never see readiness scores or feedback.
            </div>
            <ProjectIntelligence
              key={readinessProject.id}
              projectId={readinessProject.id}
              onScoreChange={(score) =>
                setProjects((prev) => prev.map((p) => (p.id === readinessProject.id ? { ...p, readiness_score: score } : p)))
              }
            />
          </div>
        ))}

      {/* ---------------- Investors (moved to /founder/investors) ---------------- */}
      {activeTab === "investors" && <LoadingRows />}

      {/* ---------------- Intro requests ---------------- */}
      {activeTab === "intros" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={introFilter}
              onChange={setIntroFilter}
              options={[
                { value: "received", label: `Received ${received.length}` },
                { value: "sent", label: `Sent ${sent.length}` },
              ]}
            />
            <ButtonLink href="/founder/investors" variant="secondary">
              <Users className="w-4 h-4" />
              Find investors
            </ButtonLink>
          </div>
          {visibleIntros.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={introFilter === "sent" ? "You haven't sent any requests" : "No intro requests yet"}
              description={
                introFilter === "sent"
                  ? "Find investors whose criteria fit your project and ask for an intro."
                  : "When an investor asks to connect about one of your published projects, it shows up here."
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleIntros.map((item) => (introFilter === "sent" ? sentRow(item) : introRow(item)))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Notifications ---------------- */}
      {activeTab === "notifications" &&
        (notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" description="Intro requests and deal room updates will show up here." />
        ) : (
          <Card padded={false} className="divide-y divide-line max-w-3xl">
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
              <Field label="Full name" htmlFor="pf-name">
                <input id="pf-name" className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </Field>
              <Field label="Company" htmlFor="pf-company">
                <input id="pf-company" className={inputClass} value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} />
              </Field>
            </div>
            <Field label="About you" htmlFor="pf-bio" hint="A few lines on your background.">
              <textarea id="pf-bio" rows={3} className={inputClass} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Location" htmlFor="pf-location">
                <input id="pf-location" className={inputClass} value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </Field>
              <Field label="LinkedIn" htmlFor="pf-linkedin">
                <input id="pf-linkedin" type="url" placeholder="https://linkedin.com/in/…" className={inputClass} value={profile.linkedin} onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })} />
              </Field>
            </div>
            <Field label="Company website" htmlFor="pf-website">
              <input id="pf-website" type="url" placeholder="https://" className={inputClass} value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            </Field>
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
                label="Keep new projects private"
                description="New projects start private. Turn off to have the publish switch on by default."
                checked={settings.defaultPrivate}
                onChange={(v) => setSettings({ ...settings, defaultPrivate: v })}
              />
              <Toggle
                label="Hide readiness feedback from investors"
                description="Always on. Scores and improvement notes are only ever shown to you."
                checked
                disabled
              />
              <Toggle
                label="Email me about strong matches"
                description="When an investor's criteria fit a published project at 90% or more. You'll always see these in Notifications."
                checked={settings.emailAlerts}
                onChange={(v) => setSettings({ ...settings, emailAlerts: v })}
              />
            </div>
            <FormFooter saved={settingsSaved} label="Save settings" />
          </form>
        </Card>
      )}
    </PortalLayout>
  );
}

/* ---------- small local pieces ---------- */

function readinessWord(score: number): string {
  if (score >= 85) return "Ready to pitch";
  if (score >= 70) return "Nearly ready";
  return "Needs work";
}

function TabLink({ tab, children, asButton = false }: { tab: Tab; children: React.ReactNode; asButton?: boolean }) {
  return (
    <Link
      href={`/founder/dashboard?tab=${tab}`}
      className={asButton ? buttonClass("secondary") : "inline-flex items-center gap-1 font-medium text-accent hover:underline"}
    >
      {children}
      {!asButton && <ArrowRight className="w-3.5 h-3.5" />}
    </Link>
  );
}

function SentStatus({ item }: { item: ProjectInterest }) {
  if (item.status === "accepted") return <Tag tone="positive">Interested</Tag>;
  if (item.status === "declined") return <Tag>Passed</Tag>;
  if (item.status === "expired") return <Tag>No response</Tag>;
  return <Tag tone="warning">Waiting for reply</Tag>;
}

function IntroStatus({ status }: { status: ProjectInterest["status"] }) {
  if (status === "accepted") return <Tag tone="positive">Accepted</Tag>;
  if (status === "declined") return <Tag>Declined</Tag>;
  return <Tag tone="warning">Waiting for you</Tag>;
}

function VisibilityTag({ published }: { published: boolean }) {
  return published ? (
    <Tag tone="positive">
      <Eye className="w-3.5 h-3.5" />
      Published
    </Tag>
  ) : (
    <Tag>
      <Lock className="w-3.5 h-3.5" />
      Private
    </Tag>
  );
}

export default function FounderDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <FounderDashboardContent />
    </Suspense>
  );
}
