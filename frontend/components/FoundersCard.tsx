"use client";

import React, { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { AuthImage, TagList } from "@/components/profile";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import type { FounderPublic } from "@/types";

/** The startup's founders as the signed-in investor may see them. Each founder's privacy settings
 *  decide whether they appear at all and whether contact details are shown (connected investors only). */
export function FoundersCard({ projectId }: { projectId: number }) {
  const [people, setPeople] = useState<FounderPublic[] | null>(null);
  useEffect(() => {
    let active = true;
    api.getProjectFounders(projectId).then((p) => active && setPeople(p)).catch(() => active && setPeople([]));
    return () => {
      active = false;
    };
  }, [projectId]);
  if (!people || people.length === 0) return null;
  return (
    <Card className="space-y-4">
      <div className="text-sm font-medium text-ink">Founders</div>
      {people.map((f) => (
        <div key={f.user_id} className="space-y-1.5">
          <div className="flex items-center gap-3">
            <AuthImage path={f.has_photo ? `/users/${f.user_id}/photo` : null} name={f.name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{f.name}</div>
              <div className="truncate text-xs text-muted">{[f.startup_role || f.role, f.headline].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          {f.background && <p className="text-sm text-ink-2">{f.background}</p>}
          {f.previous_startups && <p className="text-xs text-muted">Before: {f.previous_startups}</p>}
          <TagList items={[...f.expertise, ...f.skills].slice(0, 8)} />
          {(f.email || f.phone || f.linkedin) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {f.email && <a className="inline-flex items-center gap-1 text-accent hover:underline" href={`mailto:${f.email}`}><Mail className="h-3.5 w-3.5" />{f.email}</a>}
              {f.phone && <span className="inline-flex items-center gap-1 text-ink-2"><Phone className="h-3.5 w-3.5" />{f.phone}</span>}
              {f.linkedin && <a className="text-accent hover:underline" href={f.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
