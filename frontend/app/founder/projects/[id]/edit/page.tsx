"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ProjectForm } from "@/components/ProjectForm";
import { ButtonLink, EmptyState, LoadingRows, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { ProjectCreateInput } from "@/types";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);
  const router = useRouter();

  const [initial, setInitial] = useState<ProjectCreateInput | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.getProject(projectId).then((found) => {
      if (!active) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      setInitial({
        title: found.title,
        tagline: found.tagline || "",
        description: found.description,
        problem: found.problem,
        solution: found.solution,
        industry: found.industry,
        stage: found.stage,
        funding_required: found.funding_required,
        business_model: found.business_model,
        target_market: found.target_market,
        website: found.website || "",
        pitch_deck_url: found.pitch_deck_url || "",
        github_url: found.github_url || "",
        demo_url: found.demo_url || "",
        country: found.country || "",
        city: found.city || "",
        monthly_revenue: found.monthly_revenue ?? null,
        customer_count: found.customer_count ?? null,
        product_status: found.product_status || "",
        team_size: found.team_size ?? null,
        technical_founder: found.technical_founder ?? null,
        repeat_founder: found.repeat_founder ?? null,
        domain_expertise: found.domain_expertise ?? null,
        full_time_team: found.full_time_team ?? null,
        ip_protected: found.ip_protected ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  const handleSubmit = async (data: ProjectCreateInput) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateProject(projectId, data);
      router.push(`/founder/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the project.");
      setSaving(false);
    }
  };

  return (
    <PortalLayout role="FOUNDER" activeItem="projects" title="Edit project">
      <div className="mx-auto max-w-3xl">
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title="Project not found"
            description="It may have been removed, or it isn't part of your account."
            action={<ButtonLink href="/founder/dashboard?tab=projects">Back to projects</ButtonLink>}
          />
        ) : !initial ? (
          <LoadingRows />
        ) : (
          <>
            <PageHeader title={`Edit ${initial.title}`} />
            <ProjectForm
              mode="edit"
              initial={initial}
              submitting={saving}
              error={error}
              submitLabel="Save changes"
              cancelHref={`/founder/projects/${projectId}`}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
