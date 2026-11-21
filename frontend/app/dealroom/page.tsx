"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  MessageSquare,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  Search,
  Filter,
  Layers,
  Sparkles,
  ChevronRight,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/api";
import { DealRoom } from "@/types";
import { BrandMark } from "@/components/BrandMark";

function DealRoomsContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">(
    roleParam === "INVESTOR" ? "INVESTOR" : "FOUNDER"
  );
  const [dealRooms, setDealRooms] = useState<DealRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");

  useEffect(() => {
    let mounted = true;
    // The backend returns only the signed-in user's rooms; the account's role sets the view.
    Promise.all([api.getMe().catch(() => null), api.getDealRooms()]).then(([me, data]) => {
      if (!mounted) return;
      if (me?.role) setRole(me.role);
      setDealRooms(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRooms = dealRooms.filter((room) => {
    const matchesSearch =
      room.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.investor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.investor_firm && room.investor_firm.toLowerCase().includes(searchQuery.toLowerCase())) ||
      room.founder_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === "ALL" || room.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "INTRO_ACCEPTED":
        return <Badge variant="primary">Intro Accepted</Badge>;
      case "DUE_DILIGENCE":
        return <Badge variant="warning">Due Diligence</Badge>;
      case "TERM_SHEET":
        return <Badge variant="success">Term Sheet</Badge>;
      case "PARTNER_MEETING":
        return <Badge variant="secondary">Partner Meeting</Badge>;
      case "CLOSED":
        return <Badge variant="success">Deal Closed</Badge>;
      default:
        return <Badge variant="outline">{stage.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Header */}
      <header className="border-b border-[#E2E8F0] bg-white sticky top-0 z-20 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={role === "FOUNDER" ? "/founder/dashboard" : "/investor/dashboard"}
              className="shrink-0"
              aria-label="VentureX home"
            >
              <BrandMark size={36} className="rounded-xl" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A] font-display">
                  Secure Deal Rooms
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5E9] text-[#2E7D52] border border-[#A3E635]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D52] animate-pulse" />
                  Tamper-Evident Recording Active
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Private messaging and document sharing between matched founders and investors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role switch toggle */}
            <div className="bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] flex items-center text-xs">
              <button
                onClick={() => setRole("FOUNDER")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  role === "FOUNDER"
                    ? "bg-white text-[#0F172A] shadow-xs font-semibold"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Founder View
              </button>
              <button
                onClick={() => setRole("INVESTOR")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  role === "INVESTOR"
                    ? "bg-white text-[#0F172A] shadow-xs font-semibold"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Investor View
              </button>
            </div>

            <Link
              href={role === "FOUNDER" ? "/founder/dashboard" : "/investor/dashboard"}
              className="py-1.5 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
            >
              Exit to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Compliance & Security Banner */}
        <div className="rounded-xl border border-[#CBD5E1] bg-gradient-to-r from-[#0F1E36] to-[#1E3A8A] text-white p-5 shadow-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white/10 border border-white/20 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Private, Tamper-Evident Deal Rooms
                <Badge variant="outline" className="border-white/30 text-white bg-white/10 text-[10px]">
                  SHA-256 Chained
                </Badge>
              </div>
              <p className="text-xs text-white/80 mt-1 max-w-2xl leading-relaxed">
                Only the founder and investor in a room can open it. Every message is linked to the one before it
                with a SHA-256 hash, so any later change to the conversation history can be detected.
              </p>
            </div>
          </div>
          <div className="text-xs text-white/70 bg-black/20 px-3.5 py-2 rounded-lg border border-white/10 whitespace-nowrap">
            🔒 Participants only
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by startup, investor, or firm..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3B6F]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Stage:
            </span>
            {["ALL", "INTRO_ACCEPTED", "DUE_DILIGENCE", "TERM_SHEET"].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                  stageFilter === st
                    ? "bg-[#1B3B6F] text-white"
                    : "bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9]"
                }`}
              >
                {st === "ALL" ? "All Rooms" : st.replace("_", " ").toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Room Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-xl border border-[#E2E8F0] bg-white animate-pulse p-6" />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-subtle max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A] font-display">No Deal Rooms Found</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
              Deal Rooms are automatically initiated when a founder accepts an investor introduction request.
            </p>
            <div className="mt-4">
              <Link
                href={role === "FOUNDER" ? "/founder/dashboard?tab=intros" : "/investor/dashboard?tab=interests"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B6F] text-white text-xs font-semibold hover:bg-[#152e57] transition-colors"
              >
                Review Introduction Requests
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRooms.map((room) => {
              const counterpartyName = role === "FOUNDER" ? room.investor_name : room.founder_name;
              const counterpartyFirm =
                role === "FOUNDER" ? room.investor_firm || "Institutional Investor" : room.founder_company || "Founder";

              return (
                <div
                  key={room.id}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle hover:shadow-elevated transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                          {room.project_industry || "DeepTech / AI"}
                        </div>
                        <h2 className="text-lg font-bold text-[#0F172A] font-display hover:text-[#1B3B6F] transition-colors">
                          <Link href={`/dealroom/${room.id}?role=${role}`}>
                            {room.project_title}
                          </Link>
                        </h2>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getStageBadge(room.stage)}
                        {room.nda_signed && (
                          <span className="p-1 rounded bg-[#E8F5E9] text-[#2E7D52] title='Mutual NDA Executed'">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Counterparty Info */}
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1B3B6F] text-white font-bold flex items-center justify-center text-xs">
                          {counterpartyName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-[#0F172A]">{counterpartyName}</div>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#94A3B8]" />
                            {counterpartyFirm}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#64748B] block">Recorded Messages</span>
                        <span className="font-bold text-[#0F172A] text-xs">
                          {room.messages_count || 1} entries
                        </span>
                      </div>
                    </div>

                    {/* Last message teaser */}
                    {room.last_message && (
                      <div className="text-xs text-[#475569] bg-[#F1F5F9]/50 p-2.5 rounded-lg border border-[#E2E8F0]/60 italic mb-4 line-clamp-2">
                        &ldquo;{room.last_message}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#64748B] flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      hash: {room.audit_trail_hash ? `${room.audit_trail_hash.substring(0, 10)}...` : "active"}
                    </span>

                    <Link
                      href={`/dealroom/${room.id}?role=${role}`}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#1B3B6F] text-white font-semibold hover:bg-[#152e57] transition-all shadow-subtle"
                    >
                      Enter Deal Room
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DealRoomsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#64748B]">Loading Deal Rooms...</div>}>
      <DealRoomsContent />
    </Suspense>
  );
}
