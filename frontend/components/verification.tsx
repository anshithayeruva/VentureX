"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { Tag, cx } from "@/components/ui";
import { api, MeResponse } from "@/lib/api";
import type { InvestorVerificationStatus } from "@/types";

/* Badges and access checks for verified investors and companies. */

export function VerifiedBadge({ kind, className }: { kind: "investor" | "company"; className?: string }) {
  return (
    <Tag tone="positive" className={className}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {kind === "investor" ? "Verified investor" : "Verified company"}
    </Tag>
  );
}

let mePromise: Promise<MeResponse | null> | null = null;

/** The signed-in user, fetched once per page load and shared by every component that asks. */
export function useMe(): MeResponse | null | undefined {
  const [me, setMe] = useState<MeResponse | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    mePromise ??= api.getMe().catch(() => null);
    mePromise.then((m) => active && setMe(m));
    return () => {
      active = false;
    };
  }, []);
  return me;
}

/** Forget the cached user (after their verification status changes). */
export function refreshMe() {
  mePromise = null;
}

/** Whether this investor may contact founders: undefined while loading. */
export function useInvestorCanContact(): boolean | undefined {
  const me = useMe();
  if (me === undefined) return undefined;
  if (!me || me.role !== "INVESTOR") return false;
  return !me.verification_required || me.verification_status === "verified";
}

const BANNER: Record<Exclude<InvestorVerificationStatus, "verified">, { text: string; action: string; tone: string }> = {
  unverified: {
    text: "Verify your investor account to contact founders. Until then you can explore Discover, but not open founders' links and documents or request intros.",
    action: "Get verified",
    tone: "bg-accent-soft text-accent",
  },
  pending: {
    text: "Your account is pending review. You can explore Discover meanwhile; contact details and intro requests unlock once you're verified.",
    action: "View status",
    tone: "bg-warning-soft text-warning",
  },
  rejected: {
    text: "Your verification wasn't approved. See the reviewer's note and send it again.",
    action: "See what to fix",
    tone: "bg-danger-soft text-danger",
  },
};

/** Shown across the investor workspace until the account is verified. */
export function InvestorVerificationBanner({ me }: { me: MeResponse | null }) {
  if (!me || me.role !== "INVESTOR" || !me.verification_required) return null;
  const status = (me.verification_status || "unverified") as InvestorVerificationStatus;
  if (status === "verified") return null;
  const b = BANNER[status];
  const Icon = status === "pending" ? Clock : ShieldAlert;
  return (
    <div role="status" className={cx("mb-6 flex flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", b.tone)}>
      <span className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {b.text}
      </span>
      <Link href="/investor/verification" className="shrink-0 font-medium underline underline-offset-2">
        {b.action}
      </Link>
    </div>
  );
}
