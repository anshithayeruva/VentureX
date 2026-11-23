"use client";

import React from "react";
import { ButtonLink, Card, Tag, cx, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { OutreachProject, OutreachRelationship } from "@/types";
import { PASS_REASON_LABEL } from "@/types";

/* Shared pieces of the founder's "Find investors" pages. */

export function chequeRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${formatMoney(min)} – ${formatMoney(max)}`;
  return min != null ? `${formatMoney(min)}+` : `Up to ${formatMoney(max)}`;
}

export const ROLE_LABEL = { lead: "Leads rounds", co_invest: "Co-invests", either: "Leads or co-invests" } as const;

/** Where a founder's request (or the investor's own request) stands, as a short tag. */
export function RelationshipTag({ rel }: { rel: OutreachRelationship | null }) {
  if (!rel) return null;
  if (rel.status === "accepted") return <Tag tone="positive">Connected</Tag>;
  if (rel.initiated_by === "investor") {
    if (rel.status === "pending") return <Tag tone="accent">Asked to connect with you</Tag>;
    return <Tag>You declined their request</Tag>;
  }
  if (rel.status === "pending") return <Tag tone="warning">Request sent</Tag>;
  if (rel.status === "expired") return <Tag>No response</Tag>;
  return <Tag>Passed{rel.pass_reason ? `: ${PASS_REASON_LABEL[rel.pass_reason]}` : ""}</Tag>;
}

/** Whether the chosen project can be used to request intros at all (published, ready enough). */
export function ProjectGate({ project, minReadiness }: { project: OutreachProject | null; minReadiness: number }) {
  if (!project) return null;
  const score = project.readiness_score;
  const problems: React.ReactNode[] = [];
  if (!project.is_published) problems.push("publish it");
  if (score == null || score < minReadiness)
    problems.push(`raise its readiness score to ${Math.round(minReadiness)} (now ${score == null ? "not scored" : Math.round(score)})`);
  if (!problems.length) return null;
  return (
    <Card className="mb-5 flex flex-col gap-3 border-warning/30 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-ink">You can browse, but not request intros for {project.title} yet</div>
        <p className="text-sm text-muted">
          To protect investors from cold spam, {problems.join(" and ")} first.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {!project.is_published && <ButtonLink href={`/founder/projects/${project.id}`} variant="secondary">Open project</ButtonLink>}
        {(score == null || score < minReadiness) && <ButtonLink href="/founder/dashboard?tab=readiness">Improve readiness</ButtonLink>}
      </div>
    </Card>
  );
}

export function ProjectPicker({
  projects,
  value,
  onChange,
}: {
  projects: OutreachProject[];
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <label className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
      <span className="font-medium text-ink">Fit for</span>
      <select
        aria-label="Project to match investors against"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cx(inputClass, "sm:w-80")}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.is_published ? "" : " (private)"}
            {p.readiness_score != null ? ` · readiness ${Math.round(p.readiness_score)}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
