"use client";

import React, { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock, FileQuestion, Lock, Mail, MessagesSquare, Send } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice, ReasonLine } from "@/components/forms";
import { ProjectGate, ProjectPicker, ROLE_LABEL, RelationshipTag, chequeRange } from "@/components/outreach";
import { Avatar, Button, ButtonLink, Card, EmptyState, LoadingRows, Section, Tag, buttonClass, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { normalizeThesis, summarizeThesis } from "@/lib/thesis";
import type { OutreachProject, PublicInvestorProfile } from "@/types";
import { PASS_REASON_LABEL } from "@/types";

const NOTE_MIN = 20;
const NOTE_MAX = 1000;

function draftFor(investorName: string, project: OutreachProject | null): string {
  if (!project) return "";
  const first = investorName.split(" ")[0] || "there";
  return `Hi ${first},\n\n${project.title}: ${project.summary}\n\n`;
}

function InvestorProfileContent({ investorId }: { investorId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const projectParam = params.get("project");
  const projectId = projectParam ? Number(projectParam) : undefined;

  const [profile, setProfile] = useState<PublicInvestorProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api
      .getInvestorForFounder(investorId, projectId)
      .then((data) => {
        if (!data) {
          setMissing(true);
          return;
        }
        setProfile(data);
        setNote((current) => current || draftFor(data.name, data.project));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this investor."));
  }, [investorId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickProject = (id: number) => {
    setNote("");
    router.replace(`/founder/investors/${encodeURIComponent(investorId)}?project=${id}`);
  };

  const send = async () => {
    if (!profile?.project) return;
    setSending(true);
    setNotice(null);
    try {
      await api.requestIntroFromInvestor(investorId, profile.project.id, note.trim());
      setNotice({ text: `Request sent to ${profile.name}. You'll be notified when they reply.`, ok: true });
      load();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't send the request.", ok: false });
    } finally {
      setSending(false);
    }
  };

  const back = `/founder/investors${projectId ? `?project=${projectId}` : ""}`;

  if (missing) {
    return (
      <PortalLayout role="FOUNDER" activeItem="investors" title="Investor">
        <EmptyState
          icon={FileQuestion}
          title="Investor not found"
          description="They may have stopped listing their profile for founders."
          action={<ButtonLink href={back}>Back to investors</ButtonLink>}
        />
      </PortalLayout>
    );
  }
  if (!profile) {
    return (
      <PortalLayout role="FOUNDER" activeItem="investors" title="Investor">
        {error ? <ErrorState message={error} onRetry={() => { setError(null); load(); }} /> : <LoadingRows />}
      </PortalLayout>
    );
  }

  const thesis = normalizeThesis(profile.thesis);
  const summary = summarizeThesis(thesis);
  const cheque = chequeRange(profile.thesis.check_size?.min_check as number | null, profile.thesis.check_size?.max_check as number | null);
  const rel = profile.relationship;
  const project = profile.project;
  const gate = profile.eligibility;
  const noteLength = note.trim().length;

  return (
    <PortalLayout role="FOUNDER" activeItem="investors" title={profile.name}>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All investors
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} />
          <div>
            <h1 className="text-2xl text-ink">{profile.name}</h1>
            <p className="text-sm text-muted">{[profile.title, profile.firm, profile.location].filter(Boolean).join(" · ") || "Independent investor"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.match_score != null && (
                <Tag tone={profile.match_score >= 85 ? "positive" : "accent"}>{Math.round(profile.match_score)}% fit</Tag>
              )}
              <Tag>{ROLE_LABEL[thesis.structure.role]}</Tag>
              <RelationshipTag rel={rel} />
            </div>
          </div>
        </div>
        <ProjectPicker projects={profile.projects} value={project?.id} onChange={pickProject} />
      </div>

      <ProjectGate project={project} minReadiness={profile.min_readiness} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Section title="What they invest in">
            <Card>
              {summary.length ? (
                <ul className="space-y-2 text-sm text-ink-2">
                  {summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">This investor hasn&apos;t set their criteria yet.</p>
              )}
              <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Cheque size</dt>
                  <dd className="figure mt-1 text-ink">{cheque ?? "Not stated"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Stages</dt>
                  <dd className="mt-1 text-sm text-ink">{thesis.stages.length ? thesis.stages.join(", ") : "Any"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-faint">Usually replies</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {profile.stats.enough_data ? (
                      <>
                        {profile.stats.reply_rate}% of requests
                        {profile.stats.median_reply_days != null && <span className="text-muted"> · in ~{profile.stats.median_reply_days} days</span>}
                      </>
                    ) : (
                      <span className="text-muted">Not enough requests yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          </Section>

          <Section title="How they help portfolio companies">
            <Card>
              {profile.value_add ? (
                <p className="whitespace-pre-line text-sm text-ink-2">{profile.value_add}</p>
              ) : (
                <p className="text-sm text-muted">Not described yet.</p>
              )}
            </Card>
          </Section>

          <Section title="Past investments">
            <Card padded={!profile.portfolio.length}>
              {profile.portfolio.length ? (
                <ul className="divide-y divide-line">
                  {profile.portfolio.map((p) => (
                    <li key={`${p.company}-${p.year ?? ""}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="font-medium text-ink">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {p.company}
                          </a>
                        ) : (
                          p.company
                        )}
                      </span>
                      <span className="text-muted">{[p.stage, p.year].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No past investments listed.</p>
              )}
            </Card>
          </Section>

          {profile.bio && (
            <Section title="About">
              <Card>
                <p className="whitespace-pre-line text-sm text-ink-2">{profile.bio}</p>
              </Card>
            </Section>
          )}
        </div>

        <aside className="space-y-6">
          {project && (
            <Card>
              <div className="text-sm font-medium text-ink">Fit for {project.title}</div>
              {profile.match_score != null ? (
                <ul className="mt-3 space-y-1.5">
                  {profile.reasons.map((r) => (
                    <ReasonLine key={r.category} reason={{ ...r, explanation: `${r.category}: ${r.explanation}` }} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {profile.excluded_reason ?? (profile.criteria_set ? "A weak fit with their criteria." : "They haven't set criteria, so there's no fit score.")}
                </p>
              )}
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              {profile.email ? <Mail className="h-4 w-4" /> : <Lock className="h-4 w-4 text-muted" />}
              Contact
            </div>
            {profile.email ? (
              <a href={`mailto:${profile.email}`} className={cx(buttonClass("secondary"), "mt-3")}>
                {profile.email}
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted">Contact details are shared once they accept an intro.</p>
            )}
          </Card>

          <IntroPanel
            profile={profile}
            note={note}
            setNote={setNote}
            noteLength={noteLength}
            sending={sending}
            onSend={send}
            notice={notice}
            gate={gate}
          />
        </aside>
      </div>
    </PortalLayout>
  );
}

function IntroPanel({
  profile,
  note,
  setNote,
  noteLength,
  sending,
  onSend,
  notice,
  gate,
}: {
  profile: PublicInvestorProfile;
  note: string;
  setNote: (v: string) => void;
  noteLength: number;
  sending: boolean;
  onSend: () => void;
  notice: { text: string; ok: boolean } | null;
  gate: PublicInvestorProfile["eligibility"];
}) {
  const rel = profile.relationship;
  const title = <div className="text-sm font-medium text-ink">Request an intro</div>;

  if (rel?.status === "accepted") {
    return (
      <Card className="space-y-3">
        <div className="text-sm font-medium text-ink">You&apos;re connected</div>
        <ButtonLink href={rel.room_id ? `/dealroom/${rel.room_id}` : "/dealroom?role=FOUNDER"}>
          <MessagesSquare className="h-4 w-4" />
          Open deal room
        </ButtonLink>
      </Card>
    );
  }
  if (rel?.status === "pending" && rel.initiated_by === "investor") {
    return (
      <Card className="space-y-3">
        <div className="text-sm font-medium text-ink">{profile.name} already asked to connect</div>
        <ButtonLink href="/founder/dashboard?tab=intros">Review their request</ButtonLink>
      </Card>
    );
  }
  if (rel?.status === "pending") {
    return (
      <Card className="space-y-2">
        {notice && <Notice {...notice} />}
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Clock className="h-4 w-4 text-warning" />
          Request sent
        </div>
        <p className="text-sm text-muted">
          Waiting for {profile.name.split(" ")[0]} to reply. Requests with no reply after 14 days are marked No response.
        </p>
      </Card>
    );
  }
  if (rel?.status === "declined" && rel.initiated_by === "founder") {
    return (
      <Card className="space-y-2">
        <div className="text-sm font-medium text-ink">They passed on this project</div>
        <p className="text-sm text-ink-2">Reason: {rel.pass_reason ? PASS_REASON_LABEL[rel.pass_reason] : "Not given"}</p>
        {rel.response_note && <p className="text-sm italic text-muted">“{rel.response_note}”</p>}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      {title}
      {notice && <Notice {...notice} />}
      {!gate.can_request ? (
        <ul className="space-y-2">
          {gate.blockers.map((b) => (
            <li key={b.code} className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">
              {b.message}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="text-sm text-muted">
            We&apos;ve started your message with your project&apos;s one-liner, raise and traction. Add why this investor in particular.
          </p>
          <textarea
            aria-label="Message to the investor"
            rows={9}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={cx(inputClass, "min-h-40 resize-y")}
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {gate.daily_limit - gate.sent_today} of {gate.daily_limit} requests left today
            </span>
            <span className={noteLength > NOTE_MAX ? "text-danger" : undefined}>
              {noteLength}/{NOTE_MAX}
            </span>
          </div>
          <Button className="w-full" disabled={sending || noteLength < NOTE_MIN} onClick={onSend}>
            <Send className="h-4 w-4" />
            {sending ? "Checking and sending…" : "Send request"}
          </Button>
          <p className="text-xs text-faint">
            Before sending, we check your project against their criteria. Contact details are shared only if they reply Interested.
          </p>
        </>
      )}
    </Card>
  );
}

export default function InvestorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <InvestorProfileContent investorId={decodeURIComponent(id)} />
    </Suspense>
  );
}
