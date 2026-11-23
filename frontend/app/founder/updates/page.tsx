"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, FileText, Mail, MessageSquare, Plus, Rocket, Send, Trash2 } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { Button, ButtonLink, Card, EmptyState, Field, LoadingRows, PageHeader, Segmented, Tag, cx, inputClass } from "@/components/ui";
import { METRIC_FIELDS, MetricsGrid, TextSection } from "@/components/updates";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { FounderUpdateDetail, Project, ProjectUpdates, UpdateAudience, UpdateInput, UpdateMetrics } from "@/types";

const lastMonthEnd = () => {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
};

const blank = (): UpdateInput => ({
  period_type: "month",
  period_end: lastMonthEnd(),
  period_label: "",
  metrics: {},
  highlights: "",
  challenges: "",
  asks: [],
  audience: "investors",
});

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

function FounderUpdatesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const projectParam = params.get("project");
  const updateParam = params.get("update");

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [listing, setListing] = useState<ProjectUpdates | null>(null);
  const [detail, setDetail] = useState<FounderUpdateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const projectId = projectParam ? Number(projectParam) : projects?.[0]?.id;

  useEffect(() => {
    api.getProjects(true).then(setProjects).catch(() => setProjects([]));
  }, []);

  // A link to one update (from a notification) needs its project too.
  useEffect(() => {
    let active = true;
    if (!updateParam) return;
    api
      .getUpdate(Number(updateParam))
      .then((d) => active && setDetail(d))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Couldn't load this update."));
    return () => {
      active = false;
    };
  }, [updateParam, nonce]);

  const effectiveProject = detail && updateParam ? detail.project_id : projectId;
  useEffect(() => {
    let active = true;
    if (!effectiveProject) return;
    api
      .getProjectUpdates(effectiveProject)
      .then((l) => active && setListing(l))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Couldn't load your updates."));
    return () => {
      active = false;
    };
  }, [effectiveProject, nonce]);

  const go = useCallback(
    (q: { project?: number; update?: number | null }) => {
      const p = q.project ?? effectiveProject;
      const u = q.update === undefined ? updateParam : q.update;
      if (!u) setDetail(null);
      router.replace(`/founder/updates?${p ? `project=${p}` : ""}${u ? `&update=${u}` : ""}`);
    },
    [router, effectiveProject, updateParam]
  );

  const newUpdate = async () => {
    if (!effectiveProject) return;
    try {
      const d = await api.createUpdate(effectiveProject, blank());
      setDetail(d);
      go({ update: d.id });
      setNonce((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start an update.");
    }
  };

  const refresh = () => setNonce((n) => n + 1);

  return (
    <PortalLayout role="FOUNDER" activeItem="updates" title="Investor updates">
      {projects !== null && projects.length === 0 ? (
        <>
          <PageHeader title="Investor updates" />
          <EmptyState icon={Rocket} title="Add a project first" description="Updates are sent per company to the investors who backed it." action={<ButtonLink href="/founder/projects/new">New project</ButtonLink>} />
        </>
      ) : updateParam && detail ? (
        detail.status === "draft" ? (
          <Composer key={detail.id} detail={detail} counts={listing?.audience_counts} onBack={() => go({ update: null })} onChange={(d) => { setDetail(d); refresh(); }} onDeleted={() => { go({ update: null }); refresh(); }} />
        ) : (
          <SentView detail={detail} onBack={() => go({ update: null })} />
        )
      ) : (
        <>
          <PageHeader
            title="Investor updates"
            description="Send your investors a monthly or quarterly update: metrics, wins, challenges and what you need help with. Their portfolio stays current and they can reply to your asks."
            actions={
              <Button onClick={newUpdate} disabled={!effectiveProject}>
                <Plus className="h-4 w-4" />
                New update
              </Button>
            }
          />
          {projects && projects.length > 1 && (
            <label className="mb-5 flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="font-medium text-ink">Company</span>
              <select aria-label="Company" className={cx(inputClass, "sm:w-80")} value={effectiveProject ?? ""} onChange={(e) => go({ project: Number(e.target.value), update: null })}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          )}
          {error ? (
            <ErrorState message={error} onRetry={() => { setError(null); refresh(); }} />
          ) : !listing ? (
            <LoadingRows />
          ) : (
            <UpdatesList listing={listing} onOpen={(id) => go({ update: id })} onNew={newUpdate} />
          )}
        </>
      )}
      {updateParam && !detail && !error && <LoadingRows />}
      {updateParam && error && <ErrorState message={error} onRetry={() => { setError(null); refresh(); }} />}
    </PortalLayout>
  );
}

function UpdatesList({ listing, onOpen, onNew }: { listing: ProjectUpdates; onOpen: (id: number) => void; onNew: () => void }) {
  const reach = listing.audience_counts;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-muted">Last update sent</div>
          <div className="figure mt-1 text-lg text-ink">{listing.last_sent_at ? fmtDate(listing.last_sent_at) : "Never"}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">Next one due</div>
          <div className="figure mt-1 text-lg text-ink">{listing.next_due ? fmtDate(listing.next_due) : "Send your first"}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">Who receives it</div>
          <div className="figure mt-1 text-lg text-ink">{reach.investors} investor{reach.investors === 1 ? "" : "s"}</div>
          <div className="text-xs text-muted">+{reach.investors_and_connected - reach.investors} connected through intros</div>
        </Card>
      </div>
      {reach.investors_and_connected === 0 && (
        <Notice ok text="No one to send to yet. Investors receive your updates once they record their investment in this company on VentureX, or connect with you through an accepted intro." />
      )}
      {listing.updates.length === 0 ? (
        <EmptyState icon={FileText} title={`No updates for ${listing.project.title} yet`} description="A short monthly update keeps investors engaged and makes your next raise easier." action={<Button onClick={onNew}><Plus className="h-4 w-4" />Write the first one</Button>} />
      ) : (
        <Card padded={false} className="divide-y divide-line">
          {listing.updates.map((u) => (
            <button key={u.id} type="button" onClick={() => onOpen(u.id)} className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-subtle/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{u.period_label}</span>
                  {u.status === "draft" ? <Tag tone="warning">Draft</Tag> : <Tag tone="positive">Sent</Tag>}
                </div>
                <div className="line-clamp-1 text-sm text-muted">{u.highlights || u.challenges || "No text yet"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
                {u.status === "sent" ? (
                  <>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{u.read_count ?? 0}/{u.recipients_count} read</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{u.responses_count ?? 0} replies</span>
                    <span>{u.sent_at ? fmtDate(u.sent_at) : ""}</span>
                  </>
                ) : (
                  <span>Edited {u.created_at ? timeAgo(u.created_at) : ""}</span>
                )}
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

function toInput(d: FounderUpdateDetail): UpdateInput {
  return {
    period_type: d.period_type,
    period_end: d.period_end,
    period_label: d.period_label,
    metrics: { ...d.metrics },
    highlights: d.highlights,
    challenges: d.challenges,
    asks: d.asks,
    audience: d.audience,
  };
}

function Composer({
  detail,
  counts,
  onBack,
  onChange,
  onDeleted,
}: {
  detail: FounderUpdateDetail;
  counts?: Record<UpdateAudience, number>;
  onBack: () => void;
  onChange: (d: FounderUpdateDetail) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<UpdateInput>(toInput(detail));
  const [applyTraction, setApplyTraction] = useState(true);
  const [busy, setBusy] = useState<"save" | "send" | "delete" | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const set = (patch: Partial<UpdateInput>) => setForm((f) => ({ ...f, ...patch }));
  const setMetric = (key: keyof UpdateMetrics, value: string) => {
    const clean = value.replace(/[,\s₹]/g, "");
    set({ metrics: { ...form.metrics, [key]: clean === "" ? null : clean } });
  };
  const custom = form.metrics.custom ?? [];
  const payload = (): UpdateInput => {
    const m: UpdateMetrics = { ...form.metrics };
    delete m.runway_months;
    for (const k of ["customers", "headcount"] as const) if (m[k] !== null && m[k] !== undefined) m[k] = Number(m[k]);
    m.custom = custom.filter((c) => c.label.trim() && c.value.trim());
    return { ...form, metrics: m, asks: form.asks.filter((a) => a.trim()) };
  };

  const save = async (quiet = false) => {
    setBusy("save");
    setNotice(null);
    try {
      const d = await api.saveUpdate(detail.id, payload());
      onChange(d);
      if (!quiet) setNotice({ text: "Draft saved.", ok: true });
      return true;
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't save the draft.", ok: false });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!(await save(true))) return;
    setBusy("send");
    try {
      onChange(await api.sendUpdate(detail.id, applyTraction));
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't send the update.", ok: false });
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await api.deleteUpdate(detail.id);
      onDeleted();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't delete the draft.", ok: false });
      setBusy(null);
    }
  };

  const recipients = counts ? counts[form.audience] : detail.recipients.length;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All updates
      </button>
      <PageHeader title={`Update for ${detail.project.title}`} description="Short and honest works best: the numbers, what went well, what didn't, and what you need." />
      {notice && <Notice {...notice} />}

      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Covers a">
            <Segmented value={form.period_type} onChange={(v) => set({ period_type: v })} options={[{ value: "month", label: "Month" }, { value: "quarter", label: "Quarter" }]} />
          </Field>
          <Field label="Period ending" htmlFor="up-end">
            <input id="up-end" type="date" className={inputClass} value={form.period_end} onChange={(e) => set({ period_end: e.target.value })} />
          </Field>
          <Field label="Title (optional)" htmlFor="up-label" hint="Defaults to the month or quarter">
            <input id="up-label" className={inputClass} maxLength={40} value={form.period_label ?? ""} onChange={(e) => set({ period_label: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg text-ink">Metrics</h2>
          <p className="text-sm text-muted">Fill in what you track; leave the rest empty. Amounts in rupees. Runway is worked out from cash and burn.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_FIELDS.map((f) => (
            <Field key={f.key} label={f.money ? `${f.label} (₹)` : f.label} htmlFor={`up-${f.key}`} hint={f.hint}>
              <input id={`up-${f.key}`} inputMode="numeric" className={inputClass} value={(form.metrics[f.key] as string | number | null | undefined) ?? ""} onChange={(e) => setMetric(f.key, e.target.value)} />
            </Field>
          ))}
        </div>
        <Field label="Other metrics" hint="Anything else you track: NPS, GMV, retention…">
          <div className="space-y-2">
            {custom.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <input aria-label={`Metric ${i + 1} name`} placeholder="Name" maxLength={60} className={inputClass} value={c.label} onChange={(e) => set({ metrics: { ...form.metrics, custom: custom.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
                <input aria-label={`Metric ${i + 1} value`} placeholder="Value" maxLength={60} className={inputClass} value={c.value} onChange={(e) => set({ metrics: { ...form.metrics, custom: custom.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) } })} />
                <Button variant="ghost" aria-label={`Remove metric ${i + 1}`} onClick={() => set({ metrics: { ...form.metrics, custom: custom.filter((_, j) => j !== i) } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {custom.length < 6 && (
              <Button variant="ghost" onClick={() => set({ metrics: { ...form.metrics, custom: [...custom, { label: "", value: "" }] } })}>
                <Plus className="h-4 w-4" />
                Add a metric
              </Button>
            )}
          </div>
        </Field>
      </Card>

      <Card className="space-y-4">
        <Field label="Highlights" htmlFor="up-high" hint="Wins, launches, hires, new customers.">
          <textarea id="up-high" rows={4} maxLength={4000} className={inputClass} value={form.highlights} onChange={(e) => set({ highlights: e.target.value })} />
        </Field>
        <Field label="Challenges" htmlFor="up-low" hint="What's harder than planned. Investors trust updates that include these.">
          <textarea id="up-low" rows={3} maxLength={4000} className={inputClass} value={form.challenges} onChange={(e) => set({ challenges: e.target.value })} />
        </Field>
        <Field label="Asks" hint="Up to 5 specific things investors can help with. They can reply to each one.">
          <div className="space-y-2">
            {form.asks.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Ask ${i + 1}`} maxLength={300} placeholder="e.g. Intros to hospital CFOs in Mumbai" className={inputClass} value={a} onChange={(e) => set({ asks: form.asks.map((x, j) => (j === i ? e.target.value : x)) })} />
                <Button variant="ghost" aria-label={`Remove ask ${i + 1}`} onClick={() => set({ asks: form.asks.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {form.asks.length < 5 && (
              <Button variant="ghost" onClick={() => set({ asks: [...form.asks, ""] })}>
                <Plus className="h-4 w-4" />
                Add an ask
              </Button>
            )}
          </div>
        </Field>
      </Card>

      <Card className="space-y-4">
        <Field label="Send to">
          <select aria-label="Send to" className={cx(inputClass, "sm:w-96")} value={form.audience} onChange={(e) => set({ audience: e.target.value as UpdateAudience })}>
            <option value="investors">Investors in this company{counts ? ` (${counts.investors})` : ""}</option>
            <option value="investors_and_connected">Investors and investors I&apos;m connected with{counts ? ` (${counts.investors_and_connected})` : ""}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={applyTraction} onChange={(e) => setApplyTraction(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Also update the project&apos;s traction (revenue, customers, team size) from these numbers
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={remove} disabled={busy !== null}>
            <Trash2 className="h-4 w-4" />
            {busy === "delete" ? "Deleting…" : "Delete draft"}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => save()} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            {confirming ? (
              <Button onClick={send} disabled={busy !== null}>
                <Send className="h-4 w-4" />
                {busy === "send" ? "Sending…" : `Confirm: send to ${recipients}`}
              </Button>
            ) : (
              <Button onClick={() => setConfirming(true)} disabled={busy !== null}>
                <Send className="h-4 w-4" />
                Send update
              </Button>
            )}
          </div>
        </div>
        {confirming && <p className="text-right text-xs text-muted">Sent updates can&apos;t be edited. Each recipient gets a notification and an email.</p>}
      </Card>
    </div>
  );
}

function SentView({ detail, onBack }: { detail: FounderUpdateDetail; onBack: () => void }) {
  const read = detail.recipients.filter((r) => r.read_at).length;
  const general = detail.responses.filter((r) => r.ask_index == null);
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All updates
      </button>
      <PageHeader
        title={`${detail.project.title}: ${detail.period_label}`}
        description={`Sent ${fmtDate(detail.sent_at)} to ${detail.recipients_count} investor${detail.recipients_count === 1 ? "" : "s"} · ${read} read`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 space-y-5">
          <MetricsGrid metrics={detail.metrics} previous={detail.previous?.metrics} previousLabel={detail.previous?.period_label} />
          <TextSection title="Highlights" body={detail.highlights} />
          <TextSection title="Challenges" body={detail.challenges} />
          {detail.asks.length > 0 && (
            <div>
              <h3 className="font-sans text-sm font-medium text-muted">Asks</h3>
              <ol className="mt-2 space-y-3">
                {detail.asks.map((a, i) => {
                  const replies = detail.responses.filter((r) => r.ask_index === i);
                  return (
                    <li key={i} className="rounded-lg border border-line px-3 py-2">
                      <div className="text-sm text-ink">{i + 1}. {a}</div>
                      {replies.map((r) => (
                        <div key={r.id} className="mt-2 border-l-2 border-accent pl-3 text-sm text-ink-2">
                          <span className="font-medium text-ink">{r.name}</span>
                          {r.firm && <span className="text-muted"> · {r.firm}</span>}: {r.message}
                        </div>
                      ))}
                      {!replies.length && <div className="mt-1 text-xs text-faint">No offers yet</div>}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {general.length > 0 && (
            <div>
              <h3 className="font-sans text-sm font-medium text-muted">Replies</h3>
              <ul className="mt-2 space-y-2">
                {general.map((r) => (
                  <li key={r.id} className="border-l-2 border-accent pl-3 text-sm text-ink-2">
                    <span className="font-medium text-ink">{r.name}</span>
                    {r.firm && <span className="text-muted"> · {r.firm}</span>}: {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="h-fit space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Mail className="h-4 w-4" />
            Recipients
          </div>
          <ul className="space-y-2 text-sm">
            {detail.recipients.map((r) => (
              <li key={r.investor_id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-ink">
                  {r.name}
                  {r.firm && <span className="text-muted"> · {r.firm}</span>}
                </span>
                {r.read_at ? <Tag tone="positive">Read</Tag> : <Tag>Unread</Tag>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function FounderUpdatesPage() {
  return (
    <Suspense fallback={null}>
      <FounderUpdatesContent />
    </Suspense>
  );
}
