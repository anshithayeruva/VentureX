"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Mail, UserPlus, X } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { Avatar, Button, Card, EmptyState, Field, LoadingRows, PageHeader, Tag, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { stageLabel } from "@/lib/dealroom";
import { timeAgo } from "@/lib/format";
import type { FirmPipelineRow, MyFirm } from "@/types";

const INTRO_LABEL: Record<FirmPipelineRow["intro_status"], string> = {
  pending: "Intro pending",
  accepted: "Connected",
  declined: "Declined",
  expired: "No response",
};

export default function FirmPage() {
  const [data, setData] = useState<MyFirm | null>(null);
  const [pipeline, setPipeline] = useState<FirmPipelineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"partner" | "admin">("partner");

  const load = useCallback(
    () =>
      api
        .getMyFirm()
        .then(async (d) => {
          setData(d);
          if (d.firm) {
            setName(d.firm.name);
            setWebsite(d.firm.website);
            setPipeline((await api.getFirmPipeline()).items);
          } else {
            setPipeline(null);
          }
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your firm.")),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await action();
      setNotice({ text: ok, ok: true });
      await load();
      return true;
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
      return false;
    } finally {
      setBusy(null);
    }
  };

  // One row per startup, with every partner involved.
  const byStartup = useMemo(() => {
    const groups = new Map<number, { title: string; meta: string; rows: FirmPipelineRow[] }>();
    for (const r of pipeline ?? []) {
      const g = groups.get(r.project_id) ?? { title: r.title, meta: [r.stage, r.industry].filter(Boolean).join(" · "), rows: [] };
      g.rows.push(r);
      groups.set(r.project_id, g);
    }
    return [...groups.entries()];
  }, [pipeline]);

  return (
    <PortalLayout role="INVESTOR" activeItem="firm" title="Firm">
      <PageHeader
        title="Your firm"
        description="Add the partners you invest with. Everyone sees the firm's pipeline, so you never contact the same founder twice, and founders see your partners on your profile."
      />
      {notice && <div className="mb-5"><Notice {...notice} /></div>}
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !data ? (
        <LoadingRows />
      ) : !data.firm ? (
        <Card className="max-w-xl space-y-4">
          <div className="flex items-center gap-2 text-ink">
            <Building2 className="h-5 w-5 text-accent" />
            <span className="font-medium">Start your firm</span>
          </div>
          <p className="text-sm text-muted">You&apos;ll be its admin and can invite partners. If a partner already set up your firm, ask them to invite you instead.</p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("create", () => api.createFirm(name, website), "Firm created.");
            }}
          >
            <Field label="Firm name" htmlFor="firm-name">
              <input id="firm-name" required minLength={2} maxLength={120} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Website (optional)" htmlFor="firm-web">
              <input id="firm-web" className={inputClass} maxLength={300} value={website} onChange={(e) => setWebsite(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy !== null || name.trim().length < 2}>{busy === "create" ? "Creating…" : "Create firm"}</Button>
          </form>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <Card padded={false}>
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-lg text-ink">Firm pipeline</h2>
                <p className="text-sm text-muted">Startups any partner has asked about, connected with or invested in.</p>
              </div>
              {pipeline === null ? (
                <div className="p-5"><LoadingRows /></div>
              ) : byStartup.length === 0 ? (
                <EmptyState compact title="Nothing in the pipeline yet" description="Intro requests and deal rooms from any partner show up here." />
              ) : (
                <ul className="divide-y divide-line">
                  {byStartup.map(([pid, g]) => (
                    <li key={pid} className="px-5 py-3.5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <Link href={`/investor/projects/${pid}`} className="font-medium text-ink hover:underline">{g.title}</Link>
                        <span className="text-xs text-muted">{g.meta}</span>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {g.rows.map((r) => (
                          <li key={r.member_id} className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                            <span className="font-medium text-ink">{r.member_id === data.you ? "You" : r.member_name}</span>
                            <Tag tone={r.intro_status === "accepted" ? "positive" : r.intro_status === "pending" ? "warning" : "neutral"}>
                              {r.deal_stage ? stageLabel(r.deal_stage) : INTRO_LABEL[r.intro_status]}
                            </Tag>
                            {r.invested && <Tag tone="accent">Invested</Tag>}
                            {r.initiated_by === "founder" && <span className="text-xs text-muted">founder reached out</span>}
                            <span className="text-xs text-faint">{timeAgo(r.updated_at)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="space-y-3">
              {data.is_admin ? (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run("save", () => api.updateFirm(name, website), "Firm saved.");
                  }}
                >
                  <Field label="Firm name" htmlFor="firm-name-edit">
                    <input id="firm-name-edit" className={inputClass} minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Website" htmlFor="firm-web-edit">
                    <input id="firm-web-edit" className={inputClass} maxLength={300} value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </Field>
                  <Button type="submit" variant="secondary" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save"}</Button>
                </form>
              ) : (
                <div>
                  <div className="font-medium text-ink">{data.firm.name}</div>
                  {data.firm.website && <div className="text-sm text-muted">{data.firm.website}</div>}
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <div className="text-sm font-medium text-ink">Partners</div>
              <ul className="space-y-2.5">
                {data.members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={m.name} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{m.name}{m.user_id === data.you && <span className="text-muted"> (you)</span>}</div>
                        <div className="truncate text-xs text-muted">{m.title || m.email}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {data.is_admin && m.user_id !== data.you ? (
                        <select
                          aria-label={`Role for ${m.name}`}
                          className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs"
                          value={m.role}
                          onChange={(e) => run(m.user_id, () => api.setPartnerRole(m.user_id, e.target.value as "partner" | "admin"), "Role updated.")}
                        >
                          <option value="partner">Partner</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Tag tone={m.role === "admin" ? "accent" : "neutral"}>{m.role === "admin" ? "Admin" : "Partner"}</Tag>
                      )}
                      {(data.is_admin || m.user_id === data.you) && (
                        <button
                          type="button"
                          aria-label={m.user_id === data.you ? "Leave the firm" : `Remove ${m.name}`}
                          className="rounded p-1 text-muted hover:text-danger"
                          disabled={busy !== null}
                          onClick={() => {
                            const leaving = m.user_id === data.you;
                            if (window.confirm(leaving ? "Leave this firm?" : `Remove ${m.name} from the firm?`)) {
                              run(m.user_id, () => api.removePartner(m.user_id), leaving ? "You left the firm." : `${m.name} was removed.`);
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {data.is_admin && (
                <>
                  {data.invitations.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink-2">
                        <Mail className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate">{i.email}</span>
                      </span>
                      <button type="button" aria-label={`Withdraw invitation to ${i.email}`} className="text-muted hover:text-danger"
                        onClick={() => run(i.id, () => api.revokeInvitation(i.id), "Invitation withdrawn.")}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <form
                    className="space-y-2 border-t border-line pt-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await run("invite", () => api.invitePartner(email, role), `Invitation sent to ${email.trim()}.`)) setEmail("");
                    }}
                  >
                    <input type="email" required aria-label="Partner's email" placeholder="Partner's email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div className="flex gap-2">
                      <select aria-label="Role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value as "partner" | "admin")}>
                        <option value="partner">Partner</option>
                        <option value="admin">Admin (can manage the firm)</option>
                      </select>
                      <Button type="submit" className="shrink-0" disabled={busy !== null || !email.includes("@")}>
                        <UserPlus className="h-4 w-4" />
                        {busy === "invite" ? "Sending…" : "Invite"}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </Card>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
