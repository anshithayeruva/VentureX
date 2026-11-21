"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, FileCheck, Lock, MessagesSquare, Search } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { Avatar, ButtonLink, Card, EmptyState, LoadingRows, PageHeader, Segmented, Tag, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { DealRoom } from "@/types";
import { stageLabel, stageTone } from "@/lib/dealroom";

type StageFilter = "ALL" | "INTRO_ACCEPTED" | "DUE_DILIGENCE" | "TERM_SHEET" | "CLOSED";

function DealRoomsContent() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">(searchParams.get("role") === "INVESTOR" ? "INVESTOR" : "FOUNDER");
  const [rooms, setRooms] = useState<DealRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("ALL");

  useEffect(() => {
    let mounted = true;
    // The backend returns only the signed-in user's rooms; the account's role sets the view.
    Promise.all([api.getMe().catch(() => null), api.getDealRooms()]).then(([me, data]) => {
      if (!mounted) return;
      if (me?.role) setRole(me.role);
      setRooms(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = rooms.filter(
    (r) =>
      (stage === "ALL" || r.stage === stage) &&
      (!q || [r.project_title, r.investor_name, r.investor_firm, r.founder_name].some((v) => v?.toLowerCase().includes(q)))
  );

  return (
    <PortalLayout role={role} activeItem="dealrooms" title="Deal rooms">
      <PageHeader
        title="Deal rooms"
        description="A private space with each investor or founder you've connected with. Only the two of you can see it."
      />

      {loading ? (
        <LoadingRows />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No deal rooms yet"
          description={
            role === "FOUNDER"
              ? "A deal room opens when you accept an investor's intro request."
              : "A deal room opens when a founder accepts your intro request."
          }
          action={
            <ButtonLink href={role === "FOUNDER" ? "/founder/dashboard?tab=intros" : "/investor/dashboard?tab=browse"}>
              {role === "FOUNDER" ? "See intro requests" : "Browse startups"}
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rooms"
                className={cx(inputClass, "pl-9")}
              />
            </div>
            <Segmented
              value={stage}
              onChange={setStage}
              options={[
                { value: "ALL", label: "All" },
                { value: "INTRO_ACCEPTED", label: "New" },
                { value: "DUE_DILIGENCE", label: "Due diligence" },
                { value: "TERM_SHEET", label: "Term sheet" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState compact title="No rooms match" />
          ) : (
            <Card padded={false} className="divide-y divide-line">
              {visible.map((room) => {
                const other = role === "FOUNDER" ? room.investor_name : room.founder_name;
                const otherOrg = role === "FOUNDER" ? room.investor_firm : room.founder_company;
                return (
                  <Link
                    key={room.id}
                    href={`/dealroom/${room.id}?role=${role}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-canvas"
                  >
                    <Avatar name={other} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{room.project_title}</span>
                        <Tag tone={stageTone(room.stage)}>{stageLabel(room.stage)}</Tag>
                        {room.nda_signed && (
                          <Tag>
                            <FileCheck className="h-3.5 w-3.5" />
                            NDA signed
                          </Tag>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted">
                        With {other}
                        {otherOrg ? ` · ${otherOrg}` : ""}
                        {room.last_message ? ` — ${room.last_message}` : ""}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-faint sm:block">
                      {room.last_message_at || room.updated_at ? timeAgo(room.last_message_at || room.updated_at) : ""}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                  </Link>
                );
              })}
            </Card>
          )}

          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="h-4 w-4" />
            Messages and files in a room are only visible to its two members.
          </p>
        </div>
      )}
    </PortalLayout>
  );
}

export default function DealRoomsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <DealRoomsContent />
    </Suspense>
  );
}
