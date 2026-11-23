"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock, Plus, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { ErrorState, Notice } from "@/components/forms";
import { Button, Card, Field, LoadingRows, PageHeader, Tag, cx, inputClass } from "@/components/ui";
import { refreshMe } from "@/components/verification";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { InvestorVerification, PortfolioEntry } from "@/types";

type Deal = { company: string; stage: string; year: string };
const EMPTY_DEAL: Deal = { company: "", stage: "", year: "" };

const toDeals = (entries: PortfolioEntry[]): Deal[] =>
  entries.length
    ? entries.map((e) => ({ company: e.company, stage: e.stage ?? "", year: e.year ? String(e.year) : "" }))
    : [{ ...EMPTY_DEAL }];

export default function InvestorVerificationPage() {
  const [data, setData] = useState<InvestorVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [deals, setDeals] = useState<Deal[]>([{ ...EMPTY_DEAL }]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const apply = (v: InvestorVerification) => {
    setData(v);
    setLinkedin(v.linkedin_url);
    setWebsite(v.website);
    setDeals(toDeals(v.past_investments));
  };

  const load = useCallback(
    () =>
      api
        .getInvestorVerification()
        .then(apply)
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your verification.")),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const past = deals
        .filter((d) => d.company.trim())
        .map((d) => ({ company: d.company.trim(), stage: d.stage.trim() || null, year: d.year ? parseInt(d.year, 10) || null : null }));
      const v = await api.submitInvestorVerification({ linkedin_url: linkedin, website, past_investments: past });
      apply(v);
      refreshMe();
      setNotice({ text: "Sent for review. We'll notify you once an admin has checked it.", ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't send your evidence.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const setDeal = (i: number, patch: Partial<Deal>) => setDeals((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const verified = data?.status === "verified";

  return (
    <PortalLayout role="INVESTOR" activeItem="verification" title="Verification">
      <PageHeader
        title="Verification"
        description="Founders see a Verified investor badge once an admin has checked who you are. Verified investors can request intros, accept founders' requests and open founders' links and documents."
      />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !data ? (
        <LoadingRows />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="min-w-0">
            {verified ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-ink">
                  <BadgeCheck className="h-5 w-5 text-positive" />
                  <span className="font-medium">Your account is verified</span>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted">LinkedIn</dt>
                    <dd><a className="text-accent hover:underline" href={data.linkedin_url} target="_blank" rel="noopener noreferrer">{data.linkedin_url}</a></dd>
                  </div>
                  <div>
                    <dt className="text-muted">Firm website</dt>
                    <dd><a className="text-accent hover:underline" href={data.website} target="_blank" rel="noopener noreferrer">{data.website}</a></dd>
                  </div>
                  <div>
                    <dt className="text-muted">Past investments</dt>
                    <dd className="text-ink">{data.past_investments.map((d) => d.company).join(", ")}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {notice && <Notice {...notice} />}
                <Field label="LinkedIn profile" htmlFor="vf-linkedin" hint="Your personal profile, e.g. linkedin.com/in/your-name">
                  <input id="vf-linkedin" required className={inputClass} placeholder="https://www.linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </Field>
                <Field label="Firm website" htmlFor="vf-website" hint="Your fund, firm or angel network. Angels can use a personal site.">
                  <input id="vf-website" required className={inputClass} placeholder="https://yourfund.in" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </Field>
                <Field label="Past investments" hint="One or two companies you've invested in. They also appear on your profile for founders.">
                  <div className="space-y-2">
                    {deals.map((d, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_90px_auto]">
                        <input aria-label={`Company ${i + 1}`} placeholder="Company" className={inputClass} value={d.company} onChange={(e) => setDeal(i, { company: e.target.value })} />
                        <input aria-label={`Stage ${i + 1}`} placeholder="Stage" className={inputClass} value={d.stage} onChange={(e) => setDeal(i, { stage: e.target.value })} />
                        <input aria-label={`Year ${i + 1}`} placeholder="Year" inputMode="numeric" className={inputClass} value={d.year} onChange={(e) => setDeal(i, { year: e.target.value })} />
                        <Button variant="ghost" aria-label={`Remove company ${i + 1}`} disabled={deals.length === 1} onClick={() => setDeals((all) => all.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {deals.length < 5 && (
                      <Button variant="ghost" onClick={() => setDeals((all) => [...all, { ...EMPTY_DEAL }])}>
                        <Plus className="h-4 w-4" />
                        Add another
                      </Button>
                    )}
                  </div>
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving || !deals.some((d) => d.company.trim())}>
                    {saving ? "Sending…" : data.status === "pending" ? "Update and resend" : "Send for review"}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <aside className="space-y-4">
            <StatusCard data={data} />
            <Card className="text-sm text-muted">
              <div className="mb-2 font-medium text-ink">What changes once you&apos;re verified</div>
              <ul className="list-disc space-y-1 pl-5">
                <li>Request intros from Discover</li>
                <li>Reply Interested to founders who ask to connect</li>
                <li>Open founders&apos; websites, decks and documents</li>
                <li>A Verified investor badge on your profile</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}

function StatusCard({ data }: { data: InvestorVerification }) {
  const s = data.status;
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">Status</span>
        {s === "verified" ? (
          <Tag tone="positive"><ShieldCheck className="h-3.5 w-3.5" />Verified</Tag>
        ) : s === "pending" ? (
          <Tag tone="warning"><Clock className="h-3.5 w-3.5" />Pending review</Tag>
        ) : s === "rejected" ? (
          <Tag tone="danger"><ShieldAlert className="h-3.5 w-3.5" />Not approved</Tag>
        ) : (
          <Tag>Not verified</Tag>
        )}
      </div>
      <p className={cx("text-sm", s === "rejected" ? "text-ink-2" : "text-muted")}>
        {s === "verified"
          ? `Verified${data.reviewed_at ? ` ${timeAgo(data.reviewed_at)}` : ""}.`
          : s === "pending"
            ? `Sent${data.submitted_at ? ` ${timeAgo(data.submitted_at)}` : ""}. An admin will review it and you'll get a notification.`
            : s === "rejected"
              ? `Reviewer's note: ${data.review_note || "none"}`
              : "Send your LinkedIn, firm website and a past investment to get started."}
      </p>
    </Card>
  );
}
