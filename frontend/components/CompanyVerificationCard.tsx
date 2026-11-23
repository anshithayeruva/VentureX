"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { Notice } from "@/components/forms";
import { Button, Card, Segmented, Tag, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { CompanyVerification, RegistrationType } from "@/types";

/** "Verify your company": a code sent to an email on the startup's domain, or a registration number. */
export function CompanyVerificationCard({ projectId, onVerified }: { projectId: number; onVerified?: () => void }) {
  const [v, setV] = useState<CompanyVerification | null>(null);
  const [method, setMethod] = useState<"email" | "registration">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [regType, setRegType] = useState<RegistrationType>("gstin");
  const [regNumber, setRegNumber] = useState("");
  const [regNote, setRegNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getCompanyVerification(projectId)
      .then((data) => {
        if (!active) return;
        setV(data);
        if (!data.website_domain) setMethod("registration");
      })
      .catch(() => active && setV(null));
    return () => {
      active = false;
    };
  }, [projectId]);

  const run = async (action: () => Promise<CompanyVerification>, ok: (d: CompanyVerification) => string) => {
    setBusy(true);
    setNotice(null);
    try {
      const data = await action();
      setV(data);
      setNotice({ text: ok(data), ok: true });
      if (data.status === "verified") onVerified?.();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work. Try again.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (!v) return null;

  if (v.status === "verified") {
    return (
      <Card className="flex items-start gap-3">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
        <div className="text-sm">
          <div className="font-medium text-ink">Verified company</div>
          <p className="text-muted">
            {v.method === "domain_email"
              ? `Verified through an email on ${v.domain}.`
              : `Verified by an admin from your ${v.registration_types[v.registration_type as RegistrationType] ?? "registration number"}.`}{" "}
            Investors see the badge, and you can send more intro requests a day.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Verify your company
          </div>
          <p className="mt-1 text-sm text-muted">
            A Verified company badge tells investors your startup is real. Verified companies can also send more intro
            requests a day.
          </p>
        </div>
        {v.status === "pending" && (
          <Tag tone="warning"><Clock className="h-3.5 w-3.5" />Pending review</Tag>
        )}
        {v.status === "rejected" && (
          <Tag tone="danger"><ShieldAlert className="h-3.5 w-3.5" />Not approved</Tag>
        )}
      </div>

      {v.status === "rejected" && v.review_note && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">Reviewer&apos;s note: {v.review_note}</p>
      )}
      {notice && <Notice {...notice} />}

      {v.status === "pending" ? (
        <p className="text-sm text-muted">
          An admin is checking your {v.registration_types[v.registration_type as RegistrationType] ?? "registration number"}{" "}
          ({v.registration_number}). You&apos;ll get a notification once it&apos;s reviewed.
        </p>
      ) : (
        <>
          <Segmented
            value={method}
            onChange={setMethod}
            options={[
              { value: "email", label: "Company email" },
              { value: "registration", label: "Registration number" },
            ]}
          />
          {method === "email" ? (
            !v.website_domain ? (
              <p className="text-sm text-muted">
                Add your startup&apos;s website to the project first (
                <Link href={`/founder/projects/${projectId}/edit`} className="text-accent hover:underline">edit project</Link>
                ), or use a registration number.
              </p>
            ) : v.status === "code_sent" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  We sent a 6-digit code to <span className="text-ink">{v.email}</span>. It expires in 15 minutes.
                </p>
                <div className="flex gap-2">
                  <input
                    aria-label="Verification code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className={`${inputClass} max-w-40 tracking-widest`}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button disabled={busy || code.length !== 6} onClick={() => run(() => api.confirmCompanyCode(projectId, code), () => "Your company is verified.")}>
                    {busy ? "Checking…" : "Verify"}
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-sm text-accent hover:underline"
                  onClick={() => setV({ ...v, status: "unverified" })}
                >
                  Use a different email or resend
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor={`cv-email-${projectId}`} className="text-sm text-ink-2">
                  An email address on <span className="font-medium text-ink">{v.website_domain}</span>, your project&apos;s website
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id={`cv-email-${projectId}`}
                    type="email"
                    placeholder={`you@${v.website_domain}`}
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button
                    className="shrink-0"
                    disabled={busy || !email.includes("@")}
                    onClick={() => run(() => api.sendCompanyCode(projectId, email), (d) => `Code sent to ${d.email}.`)}
                  >
                    <Mail className="h-4 w-4" />
                    {busy ? "Sending…" : "Send code"}
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted">No company domain yet? Send a registration number; an admin checks it against the government registry.</p>
              <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                <select aria-label="Registration type" className={inputClass} value={regType} onChange={(e) => setRegType(e.target.value as RegistrationType)}>
                  {(Object.entries(v.registration_types) as [RegistrationType, string][]).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
                <input aria-label="Registration number" placeholder={regType === "gstin" ? "e.g. 27AAPFU0939F1ZV" : "Registration number"} className={inputClass} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
              </div>
              <input aria-label="Note for the reviewer" placeholder="Note for the reviewer (optional)" maxLength={1000} className={inputClass} value={regNote} onChange={(e) => setRegNote(e.target.value)} />
              <Button
                disabled={busy || !regNumber.trim()}
                onClick={() => run(() => api.submitCompanyRegistration(projectId, regType, regNumber, regNote), () => "Sent for review.")}
              >
                {busy ? "Sending…" : "Send for review"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
