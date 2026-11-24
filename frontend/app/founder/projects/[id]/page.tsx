"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, FileQuestion, Landmark, Lock, Pencil } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { CompanyVerificationCard } from "@/components/CompanyVerificationCard";
import { ProjectTeamCard } from "@/components/teams";
import { ProjectIntelligence } from "@/components/ProjectIntelligence";
import { VerifiedBadge } from "@/components/verification";
import { Button, ButtonLink, Card, EmptyState, LoadingRows, Stat, Tag } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Project } from "@/types";

export default function FounderProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getProject(projectId).then((item) => {
      if (!mounted) return;
      if (!item) {
        setNotFound(true);
        return;
      }
      setProject(item);
      setPublished(Boolean(item.is_published));
    });
    api.getMatches().then((matches) => {
      if (mounted) setMatchCount(matches.filter((m) => String(m.project_id) === String(projectId)).length);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const togglePublish = async () => {
    setPublishing(true);
    try {
      const updated = await api.togglePublishProject(projectId, !published);
      setPublished(Boolean(updated.is_published));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't change the project's visibility.");
    } finally {
      setPublishing(false);
    }
  };

  if (notFound || !project) {
    return (
      <PortalLayout role="FOUNDER" activeItem="projects" title="Project">
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title="Project not found"
            description="It may have been removed, or it isn't part of your account."
            action={<ButtonLink href="/founder/dashboard?tab=projects">Back to projects</ButtonLink>}
          />
        ) : (
          <LoadingRows />
        )}
      </PortalLayout>
    );
  }

  const links = [
    { label: "Website", href: project.website },
    { label: "GitHub", href: project.github_url },
    { label: "Demo", href: project.demo_url },
    { label: "Deck link", href: project.pitch_deck_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <PortalLayout role="FOUNDER" activeItem="projects" title={project.title}>
      <div className="space-y-8">
        <div>
          <Link href="/founder/dashboard?tab=projects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] leading-tight font-medium text-ink">{project.title}</h1>
                {published ? (
                  <Tag tone="positive">
                    <Eye className="h-3.5 w-3.5" />
                    Published
                  </Tag>
                ) : (
                  <Tag>
                    <Lock className="h-3.5 w-3.5" />
                    Private
                  </Tag>
                )}
                {project.company_verified && <VerifiedBadge kind="company" />}
                {project.is_owner === false && <Tag>You&apos;re a co-founder</Tag>}
              </div>
              {project.tagline && <p className="mt-1 text-muted">{project.tagline}</p>}
              <p className="mt-1 text-sm text-muted">
                {[project.stage, project.industry, project.business_model].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ButtonLink href={`/founder/projects/${project.id}/funding`} variant="secondary">
                <Landmark className="h-4 w-4" />
                Funding
              </ButtonLink>
              <ButtonLink href={`/founder/projects/${project.id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" />
                Edit
              </ButtonLink>
              <Button variant={published ? "secondary" : "primary"} onClick={togglePublish} disabled={publishing}>
                {publishing ? "Saving…" : published ? "Make private" : "Publish to investors"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Raising" value={formatMoney(project.funding_required)} />
          <Stat
            label="Readiness"
            value={project.readiness_score != null ? `${Math.round(project.readiness_score)} / 100` : "—"}
            hint="Only you can see this"
          />
          <Stat
            label="Investor matches"
            value={!published ? "—" : matchCount ?? "—"}
            hint={!published ? "Publish to get matched" : "Investors whose criteria fit"}
          />
        </div>

        <ProjectTeamCard projectId={project.id} />

        <CompanyVerificationCard
          projectId={project.id}
          onVerified={() => setProject((prev) => (prev ? { ...prev, company_verified: true } : prev))}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="space-y-6 lg:col-span-2">
            <TextBlock title="Summary" body={project.description} />
            <TextBlock title="Problem" body={project.problem} />
            <TextBlock title="Solution" body={project.solution} />
          </Card>
          <Card className="h-fit space-y-4 text-sm">
            <Detail label="Target customer" value={project.target_market} />
            {links.map((l) => (
              <Detail
                key={l.label}
                label={l.label}
                value={
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-accent hover:underline">
                    <span className="truncate">{l.href.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                }
              />
            ))}
            {project.created_at && <Detail label="Created" value={new Date(project.created_at).toLocaleDateString()} />}
          </Card>
        </div>

        <ProjectIntelligence
          projectId={project.id}
          onScoreChange={(score) => setProject((prev) => (prev ? { ...prev, readiness_score: score } : prev))}
        />
      </div>
    </PortalLayout>
  );
}

function TextBlock({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="font-sans text-sm font-medium text-muted">{title}</h2>
      <p className="mt-1.5 whitespace-pre-line text-ink-2 leading-relaxed">{body}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}
