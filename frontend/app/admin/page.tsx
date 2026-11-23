"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ExternalLink, ShieldCheck, UserCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ErrorState, Notice } from "@/components/forms";
import { Button, Card, EmptyState, LoadingRows, PageHeader, Segmented, Tag, cx, inputClass } from "@/components/ui";
import { useMe } from "@/components/verification";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { AdminCompanyRow, AdminInvestorRow, ReviewDecision } from "@/types";

type Kind = "investor" | "company";
type StatusFilter = "pending" | "verified" | "rejected" | "all";

const STATUS_TAG: Record<string, { label: string; tone: "warning" | "positive" | "danger" | "neutral" }> = {
  pending: { label: "Pending review", tone: "warning" },
  verified: { label: "Verified", tone: "positive" },
  rejected: { label: "Rejected", tone: "danger" },
  code_sent: { label: "Code sent", tone: "neutral" },
  unverified: { label: "Not verified", tone: "neutral" },
};

const REG_LABEL: Record<string, string> = {
  gstin: "GSTIN",
  cin: "CIN",
  llpin: "LLPIN",
  udyam: "Udyam",
};

export default function AdminPage() {
  const me = useMe();
  const [kind, setKind] = useState<Kind>("investor");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [counts, setCounts] = useState<{ investors_pending: number; companies_pending: number } | null>(null);
  const [rows, setRows] = useState<{ key: string; investors?: AdminInvestorRow[]; companies?: AdminCompanyRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);

  const key = `${kind}:${status}:${nonce}`;
  const load = useCallback(() => {
    const s = status === "all" ? undefined : status;
    api.getAdminCounts().then(setCounts).catch(() => undefined);
    (kind === "investor"
      ? api.getAdminInvestors(s).then((investors) => setRows({ key, investors }))
      : api.getAdminCompanies(s).then((companies) => setRows({ key, companies }))
    ).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the review queue."));
  }, [kind, status, key]);

  useEffect(() => {
    if (me?.is_admin) load();
  }, [me, load]);

  const review = async (decision: ReviewDecision, id: string | number, note: string, label: string) => {
    try {
      if (kind === "investor") await api.reviewInvestor(String(id), decision, note);
      else await api.reviewCompany(Number(id), decision, note);
      setNotice({ text: `${label}: ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "verification removed"}.`, ok: true });
      setNonce((n) => n + 1);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't save the review.", ok: false });
    }
  };

  const loading = rows?.key !== key && !error;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex h-14 items-center justify-between border-b border-line bg-sidebar px-4 text-white sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={26} className="border-transparent" />
          <span className="font-serif text-[17px] font-medium">VentureX</span>
          <span className="ml-2 rounded-md bg-sidebar-active px-2 py-0.5 text-xs text-sidebar-text">Admin</span>
        </Link>
        <Link
          href={me?.role === "INVESTOR" ? "/investor/dashboard" : "/founder/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm text-sidebar-text hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        {me === undefined ? (
          <LoadingRows />
        ) : !me?.is_admin ? (
          <EmptyState icon={ShieldCheck} title="Admins only" description="This page is for VentureX staff who review investors and companies." />
        ) : (
          <>
            <PageHeader
              title="Verification review"
              description="Check each investor's and company's evidence, then approve or reject it with a note. People are notified of your decision."
            />
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Segmented
                value={kind}
                onChange={(v) => { setKind(v); setNotice(null); }}
                options={[
                  { value: "investor", label: `Investors${counts ? ` · ${counts.investors_pending} pending` : ""}` },
                  { value: "company", label: `Companies${counts ? ` · ${counts.companies_pending} pending` : ""}` },
                ]}
              />
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "verified", label: "Verified" },
                  { value: "rejected", label: "Rejected" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
            {notice && <div className="mb-4"><Notice {...notice} /></div>}
            {error ? (
              <ErrorState message={error} onRetry={() => { setError(null); setNonce((n) => n + 1); }} />
            ) : loading || !rows ? (
              <LoadingRows />
            ) : kind === "investor" ? (
              rows.investors && rows.investors.length ? (
                <div className="space-y-4">
                  {rows.investors.map((r) => (
                    <ReviewCard
                      key={r.user_id}
                      status={r.status}
                      title={r.name || r.email}
                      subtitle={[r.title, r.firm, r.location].filter(Boolean).join(" · ") || "Investor"}
                      icon={UserCheck}
                      when={r.submitted_at}
                      previousNote={r.review_note}
                      evidence={[
                        ["Sign-in email", r.email],
                        ["LinkedIn", <ExtLink key="li" href={r.linkedin_url} />],
                        ["Firm website", <ExtLink key="web" href={r.website} />],
                        ["Past investments", (r.portfolio || []).map((d) => [d.company, d.stage, d.year].filter(Boolean).join(" · ")).join("; ") || "—"],
                      ]}
                      onReview={(d, note) => review(d, r.user_id, note, r.name || r.email)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState compact icon={UserCheck} title="Nothing here" description={status === "pending" ? "No investors are waiting for review." : undefined} />
              )
            ) : rows.companies && rows.companies.length ? (
              <div className="space-y-4">
                {rows.companies.map((r) => (
                  <ReviewCard
                    key={r.project_id}
                    status={r.status}
                    title={r.title}
                    subtitle={[r.founder_name, r.founder_email, [r.city, r.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    icon={Building2}
                    when={r.submitted_at}
                    previousNote={r.review_note}
                    evidence={[
                      ["Method", r.method === "domain_email" ? "Code to a company-domain email" : "Registration number"],
                      ["Website", r.website ? <ExtLink key="w" href={r.website} /> : "—"],
                      ...(r.method === "domain_email"
                        ? ([["Verified email", r.email || "—"]] as [string, React.ReactNode][])
                        : ([
                            ["Registration", `${REG_LABEL[r.registration_type || ""] || r.registration_type}: ${r.registration_number}`],
                            ["Founder's note", r.evidence_note || "—"],
                          ] as [string, React.ReactNode][])),
                    ]}
                    onReview={(d, note) => review(d, r.project_id, note, r.title)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Building2} title="Nothing here" description={status === "pending" ? "No companies are waiting for review." : undefined} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ExtLink({ href }: { href: string }) {
  if (!href) return <>—</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-accent hover:underline">
      <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, "")}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function ReviewCard({
  status,
  title,
  subtitle,
  icon: Icon,
  when,
  previousNote,
  evidence,
  onReview,
}: {
  status: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  when?: string | null;
  previousNote?: string | null;
  evidence: [string, React.ReactNode][];
  onReview: (decision: ReviewDecision, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const tag = STATUS_TAG[status] ?? STATUS_TAG.unverified;
  const act = async (d: ReviewDecision) => {
    setBusy(d);
    await onReview(d, note);
    setBusy(null);
  };
  return (
    <Card className="min-w-0 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div className="min-w-0">
            <div className="font-medium text-ink">{title}</div>
            <div className="truncate text-sm text-muted">{subtitle}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {when && <span className="text-xs text-faint">sent {timeAgo(when)}</span>}
          <Tag tone={tag.tone}>{tag.label}</Tag>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
        {evidence.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ink">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {previousNote && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">Last note: {previousNote}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          aria-label={`Note for ${title}`}
          placeholder={status === "pending" ? "Note (required to reject; shown to them)" : "Note (shown to them)"}
          maxLength={1000}
          className={cx(inputClass, "sm:flex-1")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          {status !== "verified" && (
            <Button disabled={busy !== null} onClick={() => act("approve")}>
              {busy === "approve" ? "Saving…" : "Approve"}
            </Button>
          )}
          {status !== "rejected" && status !== "verified" && (
            <Button variant="secondary" disabled={busy !== null || !note.trim()} onClick={() => act("reject")}>
              {busy === "reject" ? "Saving…" : "Reject"}
            </Button>
          )}
          {status === "verified" && (
            <Button variant="secondary" disabled={busy !== null} onClick={() => act("revoke")}>
              {busy === "revoke" ? "Saving…" : "Remove verification"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
