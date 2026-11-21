"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, FileQuestion, MessagesSquare } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
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
    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (notFound || !project) {
    return (
      <PortalLayout role="INVESTOR" activeItem="browse" title="Startup">
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title="Startup not found"
            description="The founder may have made it private."
            action={<ButtonLink href="/investor/dashboard?tab=browse">Browse startups</ButtonLink>}
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

  const links = [
    { label: "Website", href: project.website },
    { label: "Demo", href: project.demo_url },
    { label: "GitHub", href: project.github_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <PortalLayout role="INVESTOR" activeItem="browse" title={project.title}>
      <div className="space-y-8">
        <div>
          <Link href="/investor/dashboard?tab=browse" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Browse
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{project.title}</h1>
            {match && <Tag tone={match.match_score >= 85 ? "positive" : "accent"}>{Math.round(match.match_score)}% fit</Tag>}
          </div>
          {project.tagline && <p className="mt-1 text-muted">{project.tagline}</p>}
          <p className="mt-1 text-sm text-muted">
            {[project.stage, project.industry, project.business_model].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Raising" value={formatMoney(project.funding_required)} />
          <Stat label="Stage" value={project.stage} />
          <Stat label="Target customer" value={<span className="text-base font-medium">{project.target_market || "—"}</span>} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {match?.reasons?.length ? (
              <Card>
                <h2 className="text-base font-semibold text-ink">Why it fits your criteria</h2>
                <ul className="mt-3 space-y-2">
                  {match.reasons.map((r) => (
                    <li key={r.category} className="flex gap-2 text-sm text-ink-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                      <span>
                        <span className="font-medium">{r.category}:</span> {r.explanation}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            <Card className="space-y-6">
              <TextBlock title="Summary" body={project.description} />
              <TextBlock title="Problem" body={project.problem} />
              <TextBlock title="Solution" body={project.solution} />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="space-y-4">
              <h2 className="text-base font-semibold text-ink">Connect with the founder</h2>
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
                    href={interest.deal_room?.room_id ? `/dealroom/${interest.deal_room.room_id}` : "/dealroom?role=INVESTOR"}
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
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <p className="mt-1.5 whitespace-pre-line leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}
