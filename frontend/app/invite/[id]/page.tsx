"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Notice } from "@/components/forms";
import { Button, ButtonLink, LoadingRows } from "@/components/ui";
import { api } from "@/lib/api";
import type { Invitation } from "@/types";

type State =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "missing" }
  | { kind: "ready"; invite: Invitation; role: string | null | undefined };

/** Landing page for an invitation link: accept or decline as the account it was sent to. */
export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await api.getMe().catch(() => null);
      if (!active) return;
      if (!me) return setState({ kind: "signed_out" });
      const invite = await api.getInvitation(id).catch(() => null);
      if (!active) return;
      setState(invite ? { kind: "ready", invite, role: me.role } : { kind: "missing" });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const answer = async (accept: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.respondToInvitation(id, accept);
      if (!accept) {
        setNotice({ text: "Invitation declined.", ok: true });
        return;
      }
      router.replace(res.kind === "project" ? `/founder/projects/${res.project_id}` : "/investor/firm");
      router.refresh();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-elevated sm:p-9">
        <div className="mb-6 text-center">
          <BrandMark size={44} className="mb-3 rounded-xl" />
          <h1 className="text-2xl text-ink">Team invitation</h1>
        </div>
        {notice && <div className="mb-4"><Notice {...notice} /></div>}
        {state.kind === "loading" ? (
          <LoadingRows />
        ) : state.kind === "signed_out" ? (
          <div className="space-y-4 text-center text-sm text-ink-2">
            <p>Sign in, or create an account, with the email address this invitation was sent to. Then open the link again.</p>
            <div className="flex justify-center gap-2">
              <ButtonLink href="/login">Sign in</ButtonLink>
              <ButtonLink href="/register" variant="secondary">Create account</ButtonLink>
            </div>
          </div>
        ) : state.kind === "missing" ? (
          <p className="text-center text-sm text-muted">This invitation doesn&apos;t exist or was withdrawn.</p>
        ) : (
          <InviteBody invite={state.invite} busy={busy} onAnswer={answer} role={state.role} />
        )}
      </div>
    </div>
  );
}

function InviteBody({ invite, busy, onAnswer, role }: { invite: Invitation; busy: boolean; onAnswer: (accept: boolean) => void; role: string | null | undefined }) {
  const what = invite.kind === "project" ? `join ${invite.target_name} as a co-founder` : `join ${invite.target_name} as a ${invite.role}`;
  const needed = invite.kind === "project" ? "FOUNDER" : "INVESTOR";
  return (
    <div className="space-y-4 text-sm">
      <p className="flex items-start gap-2 text-ink">
        <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          <span className="font-medium">{invite.invited_by || "Someone"}</span> invited you to {what}.
        </span>
      </p>
      {invite.status !== "pending" ? (
        <p className="text-muted">This invitation was already {invite.status}.</p>
      ) : invite.expired ? (
        <p className="text-muted">This invitation has expired. Ask them to send a new one.</p>
      ) : !invite.for_you ? (
        <p className="text-muted">It was sent to {invite.email}. Sign in with that email to accept it.</p>
      ) : role && role !== needed ? (
        <p className="text-muted">
          It&apos;s for a {needed.toLowerCase()} account, and you&apos;re signed in to a {role.toLowerCase()} account.
        </p>
      ) : (
        <>
          <p className="text-muted">
            {invite.kind === "project"
              ? "As a co-founder you can edit the startup, handle intro requests, use its deal rooms and send investor updates."
              : "Partners see the firm's shared pipeline, so the firm doesn't contact the same founder twice."}
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onAnswer(true)} disabled={busy}>{busy ? "Joining…" : "Accept"}</Button>
            <Button variant="secondary" onClick={() => onAnswer(false)} disabled={busy}>Decline</Button>
          </div>
        </>
      )}
      <p className="text-center text-xs text-faint">
        <Link href="/" className="hover:underline">VentureX</Link>
      </p>
    </div>
  );
}
