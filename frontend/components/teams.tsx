"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, UserPlus, Users, X } from "lucide-react";
import { Notice } from "@/components/forms";
import { Avatar, Button, Card, Tag, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Invitation, ProjectTeam } from "@/types";

/* Team pieces: the startup team card, and the banner for invitations waiting for you. */

/** Owner and co-founders of a startup; the owner invites and removes, co-founders can leave. */
export function ProjectTeamCard({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [team, setTeam] = useState<ProjectTeam | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(
    () => api.getProjectTeam(projectId).then(setTeam).catch(() => setTeam(null)),
    [projectId]
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

  if (!team) return null;
  const cofounders = team.members.filter((m) => m.role === "cofounder");

  return (
    <Card className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Users className="h-4 w-4 text-accent" />
          Team
        </div>
        <p className="mt-1 text-sm text-muted">
          Co-founders can edit the project, run readiness checks, handle intro requests, use deal rooms and send investor
          updates. Only the owner manages the team.
        </p>
      </div>
      {notice && <Notice {...notice} />}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {team.members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={m.name} />
              <div className="min-w-0">
                <div className="truncate text-sm text-ink">
                  {m.name}
                  {m.user_id === team.you && <span className="text-muted"> (you)</span>}
                </div>
                {m.email && <div className="truncate text-xs text-muted">{m.email}</div>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Tag tone={m.role === "owner" ? "accent" : "neutral"}>{m.role === "owner" ? "Owner" : "Co-founder"}</Tag>
              {m.role === "cofounder" && (team.can_manage || m.user_id === team.you) && (
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={async () => {
                    const leaving = m.user_id === team.you;
                    if (!window.confirm(leaving ? "Leave this startup's team?" : `Remove ${m.name} from the team?`)) return;
                    const done = await run(m.user_id, () => api.removeCofounder(projectId, m.user_id), leaving ? "You left the team." : `${m.name} was removed.`);
                    if (done && leaving) router.replace("/founder/dashboard?tab=projects");
                  }}
                >
                  {m.user_id === team.you ? "Leave" : "Remove"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {team.can_manage && (
        <>
          {team.invitations.length > 0 && (
            <ul className="space-y-1.5">
              {team.invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate">{i.email}</span>
                    <span className="shrink-0 text-xs text-faint">invited {timeAgo(i.created_at)}</span>
                  </span>
                  <button type="button" aria-label={`Withdraw invitation to ${i.email}`} className="text-muted hover:text-danger"
                    onClick={() => run(i.id, () => api.revokeInvitation(i.id), "Invitation withdrawn.")}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("invite", () => api.inviteCofounder(projectId, email), `Invitation sent to ${email.trim()}.`)) setEmail("");
            }}
          >
            <input
              type="email"
              required
              aria-label="Co-founder's email"
              placeholder="Co-founder's email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="shrink-0" disabled={busy !== null || !email.includes("@")}>
              <UserPlus className="h-4 w-4" />
              {busy === "invite" ? "Sending…" : "Invite co-founder"}
            </Button>
          </form>
          {cofounders.length === 0 && team.invitations.length === 0 && (
            <p className="text-xs text-faint">They&apos;ll get an email and, if they already use VentureX, a notification.</p>
          )}
        </>
      )}
    </Card>
  );
}

/** Invitations waiting for the signed-in user, shown across the workspace. */
export function InvitationsBanner() {
  const [invites, setInvites] = useState<Invitation[]>([]);
  useEffect(() => {
    let active = true;
    api.getInvitations().then((i) => active && setInvites(i)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (!invites.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {invites.map((i) => (
        <div key={i.id} role="status" className={cx("flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent sm:flex-row sm:items-center sm:justify-between")}>
          <span className="flex items-start gap-2">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />
            {i.invited_by || "Someone"} invited you to join {i.target_name}
            {i.kind === "project" ? " as a co-founder" : ` as a ${i.role}`}.
          </span>
          <Link href={`/invite/${i.id}`} className="shrink-0 font-medium underline underline-offset-2">
            View invitation
          </Link>
        </div>
      ))}
    </div>
  );
}
