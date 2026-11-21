"use client";

import React, { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { EMPTY_PROJECT, ProjectForm, ProjectFormExtras } from "@/components/ProjectForm";
import { ButtonLink, Card, PageHeader, buttonClass } from "@/components/ui";
import { api } from "@/lib/api";
import { Project, ProjectCreateInput } from "@/types";

export default function NewProjectPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Project | null>(null);
  const [deckWarning, setDeckWarning] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: ProjectCreateInput, { publish, deck }: ProjectFormExtras) => {
    setSubmitting(true);
    setError(null);
    setDeckWarning(null);
    try {
      const project = await api.createProject({ ...data, is_published: publish });
      // The deck goes privately to the new project (never to a public folder).
      if (deck) {
        try {
          await api.uploadProjectDocument(project.id, deck, "pitch_deck");
        } catch (uploadErr) {
          setDeckWarning(
            `The project was saved, but the pitch deck didn't upload (${
              uploadErr instanceof Error ? uploadErr.message : "unknown error"
            }). You can add it from the project page.`
          );
        }
      }
      setCreated(project);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout role="FOUNDER" activeItem="new_project" title="New project">
      <div className="mx-auto max-w-3xl">
        {created ? (
          <Card className="space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-positive" />
              <div>
                <h1 className="text-xl font-semibold text-ink">{created.title} is saved</h1>
                <p className="mt-1 text-sm text-muted">
                  {created.is_published
                    ? "It's published, so investors whose criteria fit can now find it."
                    : "It's private. Only you can see it until you publish."}
                </p>
              </div>
            </div>
            {created.readiness_score != null && (
              <div className="rounded-lg bg-canvas px-4 py-3 text-sm">
                <span className="text-muted">First readiness score: </span>
                <span className="font-semibold text-ink">{Math.round(created.readiness_score)} / 100</span>
                <p className="mt-1 text-muted">
                  This is a quick check of your answers. Open the project to run the full AI review of your deck and code.
                </p>
              </div>
            )}
            {deckWarning && <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">{deckWarning}</p>}
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/founder/projects/${created.id}`}>
                <Sparkles className="h-4 w-4" />
                Open project and run review
              </ButtonLink>
              <ButtonLink href="/founder/dashboard" variant="secondary">
                Go to overview
              </ButtonLink>
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={() => {
                  setCreated(null);
                  setFormKey((k) => k + 1);
                }}
              >
                Add another project
              </button>
            </div>
          </Card>
        ) : (
          <>
            <PageHeader title="New project" description="Tell us about your startup. It stays private until you publish it." />
            <ProjectForm
              key={formKey}
              mode="create"
              initial={EMPTY_PROJECT}
              submitting={submitting}
              error={error}
              submitLabel="Create project"
              cancelHref="/founder/dashboard"
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
