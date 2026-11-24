"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, TagInput } from "@/components/forms";
import { EditableSection, ExternalLink, Facts, PhotoUploader, TagList } from "@/components/profile";
import { ButtonLink, Card, Field, LoadingRows, PageHeader, Tag, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { FounderProfileFull, UserSettings } from "@/types";

const VISIBILITY_LABEL: Record<string, string> = {
  investors: "Investors viewing your published startups",
  connected: "Only investors you've connected with",
  hidden: "Nobody: your profile isn't shown on your startups",
};

export default function FounderProfilePage() {
  const [profile, setProfile] = useState<FounderProfileFull | null>(null);
  const [draft, setDraft] = useState<FounderProfileFull | null>(null);
  const [privacy, setPrivacy] = useState<UserSettings["privacy"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api.getMyProfile<FounderProfileFull>(), api.getMySettings()])
        .then(([p, s]) => {
          setProfile(p);
          setDraft(p);
          setPrivacy(s.settings.privacy);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your profile.")),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const { email: _e, startups: _s, has_photo: _h, user_id: _u, updated_at: _t, ...body } = draft;
    void _e; void _s; void _h; void _u; void _t;
    const saved = await api.saveMyProfile<FounderProfileFull>(body);
    setProfile(saved);
    setDraft(saved);
  };
  const cancel = () => setDraft(profile);
  const set = (patch: Partial<FounderProfileFull>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

  return (
    <PortalLayout role="FOUNDER" activeItem="profile" title="Profile">
      <PageHeader
        title="Your profile"
        description="What investors learn about you on your startups. Contact details are only ever shared with investors you've connected with, and only if you allow it."
        actions={<ButtonLink href="/founder/settings" variant="secondary">Privacy settings</ButtonLink>}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !profile || !draft ? (
        <LoadingRows />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <PhotoUploader userId={profile.user_id} name={name} hasPhoto={profile.has_photo} onChanged={load} />
              <div className="min-w-0 sm:text-right">
                <div className="text-lg text-ink">{name || "Your name"}</div>
                <div className="text-sm text-muted">{profile.headline || "Add a headline"}</div>
              </div>
            </Card>

            <EditableSection
              title="Personal information"
              view={<Facts rows={[
                ["Name", name], ["Email", <span key="e" className="inline-flex items-center gap-1.5">{profile.email}<Lock className="h-3.5 w-3.5 text-faint" aria-label="From your sign-in account" /></span>],
                ["Phone", profile.phone], ["Location", profile.location], ["Headline", profile.headline], ["Biography", profile.bio],
              ]} />}
              edit={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="fp-first"><input id="fp-first" required maxLength={60} className={inputClass} value={draft.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
                  <Field label="Last name" htmlFor="fp-last"><input id="fp-last" maxLength={60} className={inputClass} value={draft.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
                  <Field label="Email" hint="Your sign-in email; change it with your sign-in provider."><input disabled className={inputClass} value={profile.email} /></Field>
                  <Field label="Phone" htmlFor="fp-phone" hint="Shared only if you allow it, with connected investors."><input id="fp-phone" type="tel" maxLength={24} placeholder="+91 98765 43210" className={inputClass} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
                  <Field label="Location" htmlFor="fp-loc"><input id="fp-loc" maxLength={120} className={inputClass} value={draft.location} onChange={(e) => set({ location: e.target.value })} /></Field>
                  <Field label="Professional headline" htmlFor="fp-head"><input id="fp-head" maxLength={120} placeholder="e.g. Building payments for clinics" className={inputClass} value={draft.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Biography" htmlFor="fp-bio"><textarea id="fp-bio" rows={4} maxLength={2000} className={inputClass} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} /></Field></div>
                </div>
              }
              onSave={save}
              onCancel={cancel}
            />

            <EditableSection
              title="Professional information"
              view={<Facts rows={[
                ["Current designation", profile.designation], ["Experience", profile.experience],
                ["Skills", <TagList key="s" items={profile.skills} />], ["Previous startups", profile.previous_startups],
                ["LinkedIn", <ExternalLink key="l" href={profile.linkedin} />], ["Website", <ExternalLink key="w" href={profile.website} />],
              ]} />}
              edit={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Current designation" htmlFor="fp-des"><input id="fp-des" maxLength={100} placeholder="e.g. CEO" className={inputClass} value={draft.designation} onChange={(e) => set({ designation: e.target.value })} /></Field>
                  <Field label="LinkedIn" htmlFor="fp-li"><input id="fp-li" maxLength={300} placeholder="linkedin.com/in/your-name" className={inputClass} value={draft.linkedin} onChange={(e) => set({ linkedin: e.target.value })} /></Field>
                  <Field label="Personal website" htmlFor="fp-web"><input id="fp-web" maxLength={300} className={inputClass} value={draft.website} onChange={(e) => set({ website: e.target.value })} /></Field>
                  <Field label="Skills" hint="Press Enter after each (up to 15)."><TagInput values={draft.skills} onChange={(v) => set({ skills: v })} placeholder="e.g. Product, Sales" max={15} /></Field>
                  <div className="sm:col-span-2"><Field label="Professional experience" htmlFor="fp-exp"><textarea id="fp-exp" rows={3} maxLength={2000} className={inputClass} value={draft.experience} onChange={(e) => set({ experience: e.target.value })} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Previous startup experience" htmlFor="fp-prev"><textarea id="fp-prev" rows={2} maxLength={1000} className={inputClass} value={draft.previous_startups} onChange={(e) => set({ previous_startups: e.target.value })} /></Field></div>
                </div>
              }
              onSave={save}
              onCancel={cancel}
            />

            <EditableSection
              title="Founder information"
              description="Your startups come from your projects and teams."
              view={<Facts rows={[
                ["Startups", profile.startups.length ? (
                  <span key="st" className="flex flex-wrap gap-2">
                    {profile.startups.map((s) => (
                      <Link key={s.id} href={`/founder/projects/${s.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-sm hover:bg-subtle">
                        {s.title}<Tag>{s.is_owner ? "Owner" : "Co-founder"}</Tag>
                      </Link>
                    ))}
                  </span>) : ""],
                ["Company", profile.company], ["Role in the startup", profile.startup_role], ["Founder background", profile.background],
                ["Areas of expertise", <TagList key="x" items={profile.expertise} />],
              ]} />}
              edit={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company" htmlFor="fp-co"><input id="fp-co" maxLength={120} className={inputClass} value={draft.company} onChange={(e) => set({ company: e.target.value })} /></Field>
                  <Field label="Role in the startup" htmlFor="fp-role"><input id="fp-role" maxLength={100} placeholder="e.g. CEO and co-founder" className={inputClass} value={draft.startup_role} onChange={(e) => set({ startup_role: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Founder background" htmlFor="fp-bg"><textarea id="fp-bg" rows={3} maxLength={2000} className={inputClass} value={draft.background} onChange={(e) => set({ background: e.target.value })} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Areas of expertise" hint="Press Enter after each (up to 15)."><TagInput values={draft.expertise} onChange={(v) => set({ expertise: v })} placeholder="e.g. Healthcare finance" max={15} /></Field></div>
                </div>
              }
              onSave={save}
              onCancel={cancel}
            />
          </div>

          <aside className="space-y-4">
            <Card className="space-y-3 text-sm">
              <div className="font-medium text-ink">Who sees this profile</div>
              {privacy && (
                <ul className="space-y-2 text-ink-2">
                  <li>{VISIBILITY_LABEL[String(privacy.profile_visibility)]}</li>
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" />Email: {privacy.show_email ? "shared with connected investors" : "not shared"}</li>
                  <li>Phone: {privacy.show_phone ? "shared with connected investors" : "not shared"}</li>
                  <li>LinkedIn: {privacy.show_linkedin ? "shared with connected investors" : "not shared"}</li>
                  <li>Traction figures: {privacy.share_traction ? "shown on published startups" : "kept private"}</li>
                </ul>
              )}
              <ButtonLink href="/founder/settings#privacy" variant="secondary">Change visibility</ButtonLink>
            </Card>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
