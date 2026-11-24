"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, KeyRound, LogOut, Monitor, Shield, SlidersHorizontal, UserRound } from "lucide-react";
import { ErrorState, Notice } from "@/components/forms";
import { Button, Card, Field, LoadingRows, PageHeader, Tag, Toggle, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth/client";
import { applyServerPreferences, formatDatePref, formatDateTimePref } from "@/lib/displayPrefs";
import type { AccountInfo, SettingsResponse, UserSettings } from "@/types";

/* Founder and investor settings: account, security, notifications, privacy, display. Every control
   here is saved on the server and enforced; passwords and sessions are handled by the sign-in service. */

type Role = "FOUNDER" | "INVESTOR";
type Section = "notifications" | "privacy" | "preferences";

// Better Auth client calls (through the app's /api/auth proxy). Typed loosely: shapes vary by version.
type AuthResult<T = unknown> = { data?: T | null; error?: { message?: string; status?: number } | null };
interface AuthExtras {
  changePassword: (b: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) => Promise<AuthResult>;
  listSessions: () => Promise<AuthResult<SessionRow[]>>;
  revokeSession: (b: { token: string }) => Promise<AuthResult>;
  revokeOtherSessions: () => Promise<AuthResult>;
  getSession: () => Promise<AuthResult<{ session?: { token?: string; id?: string } }>>;
}
interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
}
const auth = authClient as unknown as AuthExtras;

const TIME_ZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC",
];

const PRIVACY: Record<Role, { key: string; label: string; description: string }[]> = {
  FOUNDER: [
    { key: "show_email", label: "Share my email with connected investors", description: "Shown in deal rooms, Deal Flow and on your profile once you've accepted an intro." },
    { key: "show_phone", label: "Share my phone number with connected investors", description: "From your profile." },
    { key: "show_linkedin", label: "Share my LinkedIn with connected investors", description: "On your profile and in deal rooms." },
    { key: "default_private", label: "Start new projects as private", description: "New projects stay hidden from investors until you publish them." },
    { key: "allow_investor_alerts", label: "Let investors be alerted about my projects", description: "Investors whose criteria strongly fit get a notification about your published projects." },
    { key: "share_traction", label: "Share traction figures with investors", description: "Monthly revenue and customer counts on your published projects. Off: they're hidden from investors and their filters." },
  ],
  INVESTOR: [
    { key: "listed_for_founders", label: "List me in Find investors", description: "Founders with published, ready projects can find you and request an intro." },
    { key: "show_organization", label: "Show my organization to founders", description: "Your firm's name on your profile in Find investors." },
    { key: "show_email", label: "Share my email with connected founders", description: "After you accept an intro or say Interested." },
    { key: "show_phone", label: "Share my phone number with connected founders", description: "On your profile, after you connect." },
    { key: "direct_founder_messaging", label: "Let founders message me in deal rooms", description: "Off: founders can share documents but not send messages." },
  ],
};

export function SettingsView({ role }: { role: Role }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ section: string; text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState<Section | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api.getMySettings(), api.getMyAccount()])
        .then(([s, a]) => {
          setData(s);
          setDraft(structuredClone(s.settings));
          setAccount(a);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your settings.")),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const saveSection = async (section: Section) => {
    if (!data || !draft) return;
    setSaving(section);
    setNotice(null);
    try {
      const next = await api.saveMySettings({ ...data.settings, [section]: draft[section] });
      setData(next);
      setDraft((d) => (d ? { ...d, [section]: structuredClone(next.settings[section]) } : d));
      if (section === "preferences") applyServerPreferences(next.settings.preferences);
      setNotice({ section, text: "Saved.", ok: true });
    } catch (err) {
      setNotice({ section, text: err instanceof Error ? err.message : "Couldn't save.", ok: false });
    } finally {
      setSaving(null);
    }
  };
  const reset = (section: Section) => data && setDraft((d) => (d ? { ...d, [section]: structuredClone(data.settings[section]) } : d));
  const dirty = (section: Section) => !!data && !!draft && JSON.stringify(data.settings[section]) !== JSON.stringify(draft[section]);

  const footer = (section: Section) => (
    <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-5">{notice?.section === section && <span className={cx("text-sm", notice.ok ? "text-positive" : "text-danger")} role={notice.ok ? "status" : "alert"}>{notice.text}</span>}</div>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={!dirty(section) || saving !== null} onClick={() => reset(section)}>Cancel</Button>
        <Button disabled={!dirty(section) || saving !== null} onClick={() => saveSection(section)}>{saving === section ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="Your account, security, notifications, privacy and display preferences." />
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load(); }} />
      ) : !data || !draft || !account ? (
        <LoadingRows />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="sticky top-20 space-y-1 text-sm">
              {[["account", "Account", UserRound], ["security", "Security", KeyRound], ["notifications", "Notifications", Bell], ["privacy", "Privacy", Shield], ["preferences", "Preferences", SlidersHorizontal]].map(([id, label, Icon]) => {
                const I = Icon as React.ComponentType<{ className?: string }>;
                return (
                  <li key={id as string}>
                    <a href={`#${id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-subtle hover:text-ink">
                      <I className="h-4 w-4 text-muted" />
                      {label as string}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-6">
            <AccountSection role={role} account={account} onChange={setAccount} />
            <SecuritySection />

            <Card id="notifications" className="scroll-mt-20 space-y-4">
              <SectionTitle title="Notification preferences" description="Choose what reaches you in the app and by email. Security and account messages are always sent." />
              <Toggle
                label="Email notifications"
                description="Turn off to stop every notification email (in-app notifications are unaffected)."
                checked={draft.notifications.email_enabled}
                onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, email_enabled: v } })}
              />
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-faint">
                    <tr><th className="px-4 py-2 font-medium">Notification</th><th className="w-20 px-4 py-2 text-center font-medium">In-app</th><th className="w-20 px-4 py-2 text-center font-medium">Email</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {Object.entries(data.categories).map(([key, label]) => {
                      const c = draft.notifications.categories[key] ?? { in_app: true, email: true };
                      const [title, detail] = label.split(": ");
                      const set = (patch: Partial<typeof c>) =>
                        setDraft({ ...draft, notifications: { ...draft.notifications, categories: { ...draft.notifications.categories, [key]: { ...c, ...patch } } } });
                      return (
                        <tr key={key}>
                          <td className="px-4 py-3"><div className="text-ink">{title}</div>{detail && <div className="text-xs text-muted">{detail}</div>}</td>
                          <td className="px-4 py-3 text-center"><input type="checkbox" aria-label={`${title} in the app`} className="h-4 w-4 accent-[var(--color-accent)]" checked={c.in_app} onChange={(e) => set({ in_app: e.target.checked })} /></td>
                          <td className="px-4 py-3 text-center"><input type="checkbox" aria-label={`${title} by email`} className="h-4 w-4 accent-[var(--color-accent)]" disabled={!draft.notifications.email_enabled} checked={c.email && draft.notifications.email_enabled} onChange={(e) => set({ email: e.target.checked })} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {footer("notifications")}
            </Card>

            <Card id="privacy" className="scroll-mt-20 space-y-4">
              <SectionTitle title="Privacy" description={role === "FOUNDER" ? "What investors can see about you and your projects." : "What founders can see about you."} />
              {role === "FOUNDER" && (
                <Field label="Who can see your founder profile on your startups" htmlFor="pv-vis">
                  <select id="pv-vis" className={cx(inputClass, "sm:w-96")} value={String(draft.privacy.profile_visibility)} onChange={(e) => setDraft({ ...draft, privacy: { ...draft.privacy, profile_visibility: e.target.value } })}>
                    <option value="investors">Investors viewing your published startups</option>
                    <option value="connected">Only investors you&apos;ve connected with</option>
                    <option value="hidden">Nobody</option>
                  </select>
                </Field>
              )}
              <div className="divide-y divide-line">
                {PRIVACY[role].map((p) => (
                  <Toggle key={p.key} label={p.label} description={p.description} checked={Boolean(draft.privacy[p.key])}
                    onChange={(v) => setDraft({ ...draft, privacy: { ...draft.privacy, [p.key]: v } })} />
                ))}
              </div>
              {footer("privacy")}
            </Card>

            <Card id="preferences" className="scroll-mt-20 space-y-4">
              <SectionTitle title="Application preferences" description="How dates, times and amounts are shown to you." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Time zone" htmlFor="pf-tz">
                  <select id="pf-tz" className={inputClass} value={draft.preferences.time_zone} onChange={(e) => setDraft({ ...draft, preferences: { ...draft.preferences, time_zone: e.target.value } })}>
                    {[...new Set([draft.preferences.time_zone, ...TIME_ZONES])].map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                  </select>
                </Field>
                <Field label="Date format" htmlFor="pf-date" hint={`Today: ${formatDatePref(new Date())}`}>
                  <select id="pf-date" className={inputClass} value={draft.preferences.date_format} onChange={(e) => setDraft({ ...draft, preferences: { ...draft.preferences, date_format: e.target.value } })}>
                    {data.date_formats.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                {role === "INVESTOR" && (
                  <Field label="Currency display" htmlFor="pf-num" hint="Amounts stay in rupees (₹).">
                    <select id="pf-num" className={inputClass} value={draft.preferences.number_format ?? "indian"} onChange={(e) => setDraft({ ...draft, preferences: { ...draft.preferences, number_format: e.target.value } })}>
                      <option value="indian">Indian: ₹12,50,000 · ₹12.5 L · ₹1.2 Cr</option>
                      <option value="international">International: ₹1,250,000 · ₹1.25M</option>
                    </select>
                  </Field>
                )}
              </div>
              <Toggle label="Show the unread count on the notifications bell" description="Notifications still arrive; this only hides the number."
                checked={draft.preferences.show_unread_badge} onChange={(v) => setDraft({ ...draft, preferences: { ...draft.preferences, show_unread_badge: v } })} />
              {footer("preferences")}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg text-ink">{title}</h2>
      {description && <p className="text-sm text-muted">{description}</p>}
    </div>
  );
}

function AccountSection({ role, account, onChange }: { role: Role; account: AccountInfo; onChange: (a: AccountInfo) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const run = async (fn: () => Promise<AccountInfo>, ok: string) => {
    setBusy(true);
    setNotice(null);
    try {
      onChange(await fn());
      setNotice({ text: ok, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="account" className="scroll-mt-20 space-y-4">
      <SectionTitle title="Account" />
      {notice && <Notice {...notice} />}
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
        <dt className="text-muted">Email</dt>
        <dd className="text-ink">{account.email} {account.email_verified ? <Tag tone="positive">Verified</Tag> : <Tag tone="warning">Not verified</Tag>}</dd>
        <dt className="text-muted">Workspace</dt>
        <dd className="text-ink">{role === "FOUNDER" ? "Founder" : "Investor"}</dd>
        <dt className="text-muted">Member since</dt>
        <dd className="text-ink">{formatDatePref(account.created_at)}</dd>
        <dt className="text-muted">Account status</dt>
        <dd className="text-ink">{account.status === "active" ? <Tag tone="positive">Active</Tag> : <Tag tone="warning">Deletion requested</Tag>}</dd>
        {role === "INVESTOR" && (
          <>
            <dt className="text-muted">Investor verification</dt>
            <dd className="text-ink"><Link href="/investor/verification" className="text-accent hover:underline">{account.verification_status === "verified" ? "Verified" : "Not verified yet"}</Link></dd>
          </>
        )}
      </dl>
      <p className="text-xs text-faint">Your email is your sign-in address and is managed by the sign-in service.</p>
      <div className="border-t border-line pt-4">
        <div className="text-sm font-medium text-ink">Delete account</div>
        {account.deletion_requested_at ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">You asked to delete your account on {formatDatePref(account.deletion_requested_at)}. An admin will process it; you can cancel until then.</p>
            <Button variant="secondary" disabled={busy} onClick={() => run(() => api.cancelAccountDeletion(), "Deletion request cancelled.")}>Cancel request</Button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted">Ask VentureX to delete your account and data. An admin processes requests by hand.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input aria-label="Reason (optional)" placeholder="Reason (optional)" maxLength={1000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="secondary" className="shrink-0" disabled={busy} onClick={() => {
                if (window.confirm("Request deletion of your VentureX account?")) run(() => api.requestAccountDeletion(reason), "Deletion requested.");
              }}>Request deletion</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadSessions = useCallback(
    () =>
      Promise.all([auth.listSessions(), auth.getSession()])
        .then(([list, me]) => {
          if (list.error) throw new Error(list.error.message || "Couldn't load sessions.");
          setSessions(list.data ?? []);
          setCurrentToken(me.data?.session?.token ?? null);
        })
        .catch((err) => setSessionsError(err instanceof Error ? err.message : "Couldn't load sessions.")),
    []
  );
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (next.length < 8) return setNotice({ text: "Use at least 8 characters.", ok: false });
    if (next !== confirm) return setNotice({ text: "The new passwords don't match.", ok: false });
    if (next === current) return setNotice({ text: "Choose a password different from the current one.", ok: false });
    setBusy(true);
    try {
      const res = await auth.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers });
      if (res.error) throw new Error(res.error.status === 400 || res.error.status === 401 ? "Your current password isn't right." : res.error.message || "Couldn't change the password.");
      setCurrent(""); setNext(""); setConfirm("");
      setNotice({ text: signOutOthers ? "Password changed. Other sessions were signed out." : "Password changed.", ok: true });
      loadSessions();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Couldn't change the password.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="security" className="scroll-mt-20 space-y-5">
      <SectionTitle title="Security" description="Passwords and sessions are handled by VentureX's sign-in service; VentureX never stores your password." />
      <form onSubmit={change} className="space-y-3">
        <div className="text-sm font-medium text-ink">Change password</div>
        {notice && <Notice {...notice} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <input type="password" aria-label="Current password" placeholder="Current password" autoComplete="current-password" required className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input type="password" aria-label="New password" placeholder="New password (8+ characters)" autoComplete="new-password" required minLength={8} className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
          <input type="password" aria-label="Confirm new password" placeholder="Confirm new password" autoComplete="new-password" required className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Sign out of other devices
        </label>
        <Button type="submit" disabled={busy || !current || !next}>{busy ? "Changing…" : "Change password"}</Button>
      </form>

      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink">Active sessions</div>
          {sessions && sessions.length > 1 && (
            <Button variant="secondary" onClick={async () => { await auth.revokeOtherSessions(); loadSessions(); }}>
              <LogOut className="h-4 w-4" />
              Sign out other sessions
            </Button>
          )}
        </div>
        {sessionsError ? (
          <p className="text-sm text-muted">{sessionsError}</p>
        ) : !sessions ? (
          <LoadingRows />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {[...sessions]
              .sort((a, b) => Number(b.token === currentToken) - Number(a.token === currentToken) || +new Date(b.updatedAt ?? b.createdAt) - +new Date(a.updatedAt ?? a.createdAt))
              .slice(0, showAll ? undefined : 5)
              .map((s) => {
              const here = s.token === currentToken;
              return (
                <li key={s.id} className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex min-w-0 items-start gap-2">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{describeAgent(s.userAgent)} {here && <Tag tone="positive">This device</Tag>}</span>
                      <span className="block text-xs text-muted">Signed in {formatDateTimePref(s.createdAt)}{s.ipAddress ? ` · ${s.ipAddress}` : ""}</span>
                    </span>
                  </span>
                  {!here && (
                    <Button variant="ghost" onClick={async () => { await auth.revokeSession({ token: s.token }); loadSessions(); }}>Sign out</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {sessions && sessions.length > 5 && (
          <button type="button" className="text-sm text-accent hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${sessions.length} sessions`}
          </button>
        )}
      </div>
    </Card>
  );
}

function describeAgent(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
