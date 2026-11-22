"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, FileQuestion, MessagesSquare } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ReasonLine } from "@/components/forms";
import { Button, ButtonLink, Card, EmptyState, LoadingRows, Stat, Tag, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { MatchItem, Project, ProjectInterest } from "@/types";

export default function InvestorProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [match, setMatch] = useState<MatchItem | null>(null);
  const [interest, setInterest] = useState<ProjectInterest | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getProject(projectId).then((found) => {
      if (!mounted) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      setProject(found);
    });
    api.getMatches().then((all) => mounted && setMatch(all.find((m) => String(m.project_id) === String(projectId)) || null));
    api.getInterests().then((all) => {
      if (!mounted || !Array.isArray(all)) return;
      setInterest(all.find((i: ProjectInterest) => String(i.project_id) === String(projectId)) || null);
    });
    api
      .getDealFlow()
      .then((flow) => mounted && setSaved(flow.items.some((i) => String(i.project_id) === String(projectId) && i.saved)))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (notFound || !project) {
    return (
      <PortalLayout role="INVESTOR" activeItem="discover" title="Startup">
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title="Startup not found"
            description="The founder may have made it private."
            action={<ButtonLink href="/investor/discover">Browse startups</ButtonLink>}
          />
        ) : (
          <LoadingRows />
        )}
      </PortalLayout>
    );
  }

  const requestIntro = async () => {
    setSending(true);
    setError(null);
    try {
      const created = await api.expressInterest({
        project_id: project.id,
        project_title: project.title,
        project_industry: project.industry,
        message: note.trim() || `I'd like to learn more about ${project.title} and your ${project.stage} round.`,
      });
      setInterest(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the request.");
    } finally {
      setSending(false);
    }
  };

  const toggleSaved = async () => {
    setSavingBookmark(true);
    setError(null);
    try {
      await api.setSaved(project.id, !saved);
      setSaved(!saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update saved startups.");
    } finally {
      setSavingBookmark(false);
    }
  };

  const location = [project.city, project.country].filter(Boolean).join(", ");
  const facts = [
    { label: "Target customer", value: project.target_market },
    { label: "Based in", value: location },
    { label: "Business model", value: project.business_model },
    {
      label: "Monthly revenue",
      value: project.monthly_revenue != null ? formatMoney(project.monthly_revenue) : "",
    },
    { label: "Customers", value: project.customer_count != null ? project.customer_count.toLocaleString() : "" },
    { label: "Product", value: PRODUCT_STATUS[project.product_status || ""] || "" },
    { label: "Team size", value: project.team_size != null ? String(project.team_size) : "" },
    {
      label: "Team",
      value: [
        project.technical_founder ? "Technical founder" : null,
        project.repeat_founder ? "Repeat founder" : null,
        project.domain_expertise ? "Industry experience" : null,
        project.full_time_team ? "Full-time" : null,
      ]
        .filter(Boolean)
        .join(", "),
    },
    { label: "IP", value: project.ip_protected == null ? "" : project.ip_protected ? "Filed or granted" : "None yet" },
  ].filter((f) => f.value);

  const links = [
    { label: "Website", href: project.website },
    { label: "Demo", href: project.demo_url },
    { label: "GitHub", href: project.github_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <PortalLayout role="INVESTOR" activeItem="discover" title={project.title}>
      <div className="space-y-8">
        <div>
          <Link href="/investor/discover" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Discover
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] leading-tight font-medium text-ink">{project.title}</h1>
              {match && <Tag tone={match.match_score >= 85 ? "positive" : "accent"}>{Math.round(match.match_score)}% fit</Tag>}
            </div>
            <Button variant="secondary" onClick={toggleSaved} disabled={savingBookmark} aria-pressed={saved}>
              {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
          {project.tagline && <p className="mt-1 text-muted">{project.tagline}</p>}
          <p className="mt-1 text-sm text-muted">
            {[project.stage, project.industry, project.business_model].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Raising" value={formatMoney(project.funding_required)} />
          <Stat label="Stage" value={project.stage} />
          <Stat
            label="Fit with your criteria"
            value={match ? `${Math.round(match.match_score)}%` : "—"}
            hint={match ? undefined : "Outside your criteria"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {match?.reasons?.length ? (
              <Card>
                <h2 className="text-lg font-medium text-ink">How it matches your criteria</h2>
                <ul className="mt-3 space-y-2">
                  {match.reasons.map((r) => (
                    <ReasonLine key={r.category} reason={{ ...r, explanation: `${r.category}: ${r.explanation}` }} />
                  ))}
                </ul>
              </Card>
            ) : null}
            {facts.length > 0 && (
              <Card>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="mt-0.5 font-medium text-ink">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-muted">These details are reported by the founder and not verified by VentureX.</p>
              </Card>
            )}
            <Card className="space-y-6">
              <TextBlock title="Summary" body={project.description} />
              <TextBlock title="Problem" body={project.problem} />
              <TextBlock title="Solution" body={project.solution} />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="space-y-4">
              <h2 className="text-lg font-medium text-ink">Connect with the founder</h2>
              {!interest ? (
                <>
                  <p className="text-sm text-muted">
                    The founder sees your note and profile, and decides whether to open a deal room with you.
                  </p>
                  <textarea
                    rows={4}
                    className={inputClass}
                    placeholder="Add a short note (optional): why you're interested, what you'd like to see."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {error && <p className="text-sm text-danger">{error}</p>}
                  <Button className="w-full" onClick={requestIntro} disabled={sending}>
                    {sending ? "Sending…" : "Request intro"}
                  </Button>
                </>
              ) : interest.status === "accepted" ? (
                <>
                  <Tag tone="positive">Founder accepted</Tag>
                  <ButtonLink
                    className="w-full"
                    href={interest.deal_room?.room_id ? `/dealroom/${interest.deal_room.room_id}` : "/investor/deal-flow"}
                  >
                    <MessagesSquare className="h-4 w-4" />
                    Open deal room
                  </ButtonLink>
                </>
              ) : interest.status === "declined" ? (
                <>
                  <Tag>Declined</Tag>
                  <p className="text-sm text-muted">The founder decided not to connect this time.</p>
                </>
              ) : (
                <>
                  <Tag tone="warning">Intro requested</Tag>
                  <p className="text-sm text-muted">You&apos;ll be notified when the founder replies.</p>
                </>
              )}
            </Card>

            {links.length > 0 && (
              <Card className="space-y-3 text-sm">
                {links.map((l) => (
                  <div key={l.label} className="min-w-0">
                    <div className="text-muted">{l.label}</div>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-accent hover:underline">
                      <span className="truncate">{l.href.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

function TextBlock({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="font-sans text-sm font-medium text-muted">{title}</h2>
      <p className="mt-1.5 whitespace-pre-line leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

const PRODUCT_STATUS: Record<string, string> = {
  idea: "Idea",
  prototype: "Prototype",
  beta: "In beta",
  launched: "Launched",
  scaling: "Scaling",
};
