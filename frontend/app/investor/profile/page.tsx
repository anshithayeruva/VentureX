"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, TagInput } from "@/components/forms";
import { EditableSection, ExternalLink, Facts, PhotoUploader, TagList } from "@/components/profile";
import { VerifiedBadge } from "@/components/verification";
import { ButtonLink, Card, Field, LoadingRows, PageHeader, Tag, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { InvestorProfileFull, InvestorType, UserSettings } from "@/types";

const INVESTOR_TYPE_LABEL: Record<InvestorType, string> = {
  "": "Not set",
  angel: "Angel investor",
  vc: "Venture capital fund",
  micro_vc: "Micro VC",
  family_office: "Family office",
  corporate_vc: "Corporate VC",
  accelerator: "Accelerator / incubator",
  syndicate: "Angel syndicate / network",
  other: "Other",
};

export default function InvestorProfilePage() {
  const [profile, setProfile] = useState<InvestorProfileFull | null>(null);
  const [draft, setDraft] = useState<InvestorProfileFull | null>(null);
  const [privacy, setPrivacy] = useState<UserSettings["privacy"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api.getMyProfile<InvestorProfileFull>(), api.getMySettings()])
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
    const body = {
      first_name: draft.first_name, last_name: draft.last_name, phone: draft.phone, location: draft.location,
      headline: draft.headline, bio: draft.bio, linkedin: draft.linkedin, website: draft.website, expertise: draft.expertise,
      firm: draft.firm, title: draft.title, investor_type: draft.investor_type, experience: draft.experience,
      focus: draft.focus, value_add: draft.value_add,
    };
    const saved = await api.saveMyProfile<InvestorProfileFull>(body);
    setProfile(saved);
    setDraft(saved);
  };
  const cancel = () => setDraft(profile);
  const set = (patch: Partial<InvestorProfileFull>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

  return (
    <PortalLayout role="INVESTOR" activeItem="profile" title="Profile">
      <PageHeader
        title="Your profile"
        description="What founders see when they find you. Only details you enter are shown; contact details reach founders only after you connect, if you allow it."
        actions={<ButtonLink href="/investor/settings" variant="secondary">Privacy settings</ButtonLink>}
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
                <div className="text-sm text-muted">{[profile.title, profile.firm].filter(Boolean).join(", ") || "Add your organization"}</div>
                <div className="mt-1">{profile.verification_status === "verified" ? <VerifiedBadge kind="investor" /> : <Link href="/investor/verification" className="text-xs text-accent hover:underline">Not verified yet</Link>}</div>
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
                  <Field label="First name" htmlFor="ip-first"><input id="ip-first" required maxLength={60} className={inputClass} value={draft.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
                  <Field label="Last name" htmlFor="ip-last"><input id="ip-last" maxLength={60} className={inputClass} value={draft.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
                  <Field label="Email" hint="Your sign-in email; change it with your sign-in provider."><input disabled className={inputClass} value={profile.email} /></Field>
                  <Field label="Phone" htmlFor="ip-phone" hint="Shared only if you allow it, with connected founders."><input id="ip-phone" type="tel" maxLength={24} className={inputClass} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
                  <Field label="Location" htmlFor="ip-loc"><input id="ip-loc" maxLength={120} className={inputClass} value={draft.location} onChange={(e) => set({ location: e.target.value })} /></Field>
                  <Field label="Professional headline" htmlFor="ip-head"><input id="ip-head" maxLength={120} placeholder="e.g. Seed investor in health and fintech" className={inputClass} value={draft.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Biography" htmlFor="ip-bio"><textarea id="ip-bio" rows={4} maxLength={2000} className={inputClass} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} /></Field></div>
                </div>
              }
              onSave={save}
              onCancel={cancel}
            />

            <EditableSection
              title="Organization"
              description={profile.firm_managed ? "Your firm's name is managed on the Firm page." : undefined}
              view={<Facts rows={[
                ["Organization", profile.firm], ["Designation", profile.title], ["Investor type", profile.investor_type ? INVESTOR_TYPE_LABEL[profile.investor_type] : ""],
                ["Website", <ExternalLink key="w" href={profile.website} />], ["LinkedIn", <ExternalLink key="l" href={profile.linkedin} />],
                ["Investment experience", profile.experience],
              ]} />}
              edit={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organization or firm" htmlFor="ip-firm" hint={profile.firm_managed ? "Set by your firm" : undefined}>
                    <input id="ip-firm" maxLength={120} disabled={profile.firm_managed} className={inputClass} value={draft.firm} onChange={(e) => set({ firm: e.target.value })} />
                  </Field>
                  <Field label="Designation" htmlFor="ip-title"><input id="ip-title" maxLength={100} placeholder="e.g. Partner" className={inputClass} value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>
                  <Field label="Investor type" htmlFor="ip-type">
                    <select id="ip-type" className={inputClass} value={draft.investor_type} onChange={(e) => set({ investor_type: e.target.value as InvestorType })}>
                      {(Object.keys(INVESTOR_TYPE_LABEL) as InvestorType[]).map((k) => (
                        <option key={k} value={k}>{INVESTOR_TYPE_LABEL[k]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Organization website" htmlFor="ip-web"><input id="ip-web" maxLength={300} className={inputClass} value={draft.website} onChange={(e) => set({ website: e.target.value })} /></Field>
                  <Field label="LinkedIn" htmlFor="ip-li"><input id="ip-li" maxLength={300} placeholder="linkedin.com/in/your-name" className={inputClass} value={draft.linkedin} onChange={(e) => set({ linkedin: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Investment experience" htmlFor="ip-exp" hint="In your own words, e.g. years investing, number of deals."><textarea id="ip-exp" rows={3} maxLength={2000} className={inputClass} value={draft.experience} onChange={(e) => set({ experience: e.target.value })} /></Field></div>
                </div>
              }
              onSave={save}
              onCancel={cancel}
            />

            <EditableSection
              title="Investment background"
              description="Domains, stages and geography come from your investment criteria, so there's one place to keep them current."
              view={<Facts rows={[
                ["Investment domains", <TagList key="d" items={profile.criteria.sectors} />],
                ["Preferred stages", <TagList key="s" items={profile.criteria.stages} />],
                ["Geography", profile.criteria.geography],
                ["Investment focus", profile.focus],
                ["Areas of expertise", <TagList key="x" items={profile.expertise} />],
                ["How you help founders", profile.value_add],
              ]} />}
              edit={
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    Domains, stages and geography: <Link href="/investor/preferences" className="text-accent hover:underline">edit your criteria</Link>.
                  </p>
                  <Field label="Investment focus" htmlFor="ip-focus"><textarea id="ip-focus" rows={2} maxLength={1000} className={inputClass} value={draft.focus} onChange={(e) => set({ focus: e.target.value })} /></Field>
                  <Field label="Areas of expertise" hint="Press Enter after each (up to 15)."><TagInput values={draft.expertise} onChange={(v) => set({ expertise: v })} placeholder="e.g. Go-to-market" max={15} /></Field>
                  <Field label="How you help portfolio companies" htmlFor="ip-value"><textarea id="ip-value" rows={3} maxLength={1500} className={inputClass} value={draft.value_add} onChange={(e) => set({ value_add: e.target.value })} /></Field>
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
                  <li>{privacy.listed_for_founders ? "Listed in Find investors for founders" : <Tag>Hidden from Find investors</Tag>}</li>
                  <li>Organization: {privacy.show_organization ? "shown" : "hidden"}</li>
                  <li>Email: {privacy.show_email ? "shared with connected founders" : "not shared"}</li>
                  <li>Phone: {privacy.show_phone ? "shared with connected founders" : "not shared"}</li>
                </ul>
              )}
              <ButtonLink href="/investor/settings#privacy" variant="secondary">Change visibility</ButtonLink>
            </Card>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
