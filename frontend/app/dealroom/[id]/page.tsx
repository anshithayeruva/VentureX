"use client";

import React, { useState, useEffect, useRef, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Send,
  Paperclip,
  Download,
  Mail,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  User,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileCheck,
  History,
  Check,
  X,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { api, MeResponse } from "@/lib/api";
import { getApiToken } from "@/lib/auth/client";
import {
  DealRoom,
  DealMessage,
  DealRoomAuditLog,
  MessageAttachment,
} from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function DealRoomDetailContent({ params }: PageProps) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  const searchParams = useSearchParams();
  const router = useRouter();

  const roleParam = searchParams.get("role");
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">(
    roleParam === "INVESTOR" ? "INVESTOR" : "FOUNDER"
  );

  const [room, setRoom] = useState<DealRoom | null>(null);
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<DealRoomAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Modals & Drawers
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Real-time WebSocket, Typing & Presence
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New Document Form & Upload
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocType, setNewDocType] = useState<string>("financial_model");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docSizeKb, setDocSizeKb] = useState<number>(1240);

  // Stage Update Form
  const [newStage, setNewStage] = useState<string>("DUE_DILIGENCE");
  const [stageNote, setStageNote] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Identity comes from the signed-in account (/api/me); the backend also enforces it on every write.
  const [me, setMe] = useState<MeResponse | null>(null);
  const currentUserId = me?.id ?? "";
  const currentUserName = me?.name || me?.email || "You";

  useEffect(() => {
    let active = true;
    api.getMe().then((account) => {
      if (!active || !account) return;
      setMe(account);
      if (account.role) setRole(account.role);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load Room & Messages
  const fetchRoomData = async () => {
    const r = await api.getDealRoom(roomId, currentUserId);
    if (r) setRoom(r);
    const msgs = await api.getDealRoomMessages(roomId, currentUserId);
    setMessages(msgs);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRoomData().finally(() => {
      if (mounted) setLoading(false);
    });

    // Establish Live Bidirectional WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http(s?):\/\//, "")
      : "localhost:8000";
    const baseWsUrl = `${protocol}//${host}/api/dealrooms/ws/${roomId}`;

    let socket: WebSocket | null = null;
    // Browsers can't send an Authorization header on WebSockets, so the short-lived
    // Neon Auth token goes in the query string; the server verifies it and checks the
    // user is a party to this room.
    const connect = async () => {
      const token = await getApiToken();
      if (!mounted || !token) return;
      socket = new WebSocket(`${baseWsUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mounted) return;
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        if (!mounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "message" && payload.data) {
            const incomingMsg: DealMessage = payload.data;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              return [...prev, incomingMsg];
            });
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    last_message: incomingMsg.content,
                    last_message_at: incomingMsg.created_at,
                    messages_count: (prev.messages_count || 0) + 1,
                  }
                : null
            );
          } else if (payload.type === "typing") {
            if (payload.user_id !== currentUserId) {
              setTypingUser(payload.is_typing ? payload.user_name : null);
              if (payload.is_typing) {
                setTimeout(() => setTypingUser(null), 3000);
              }
            }
          } else if (payload.type === "presence") {
            setPartnerOnline(payload.event === "joined");
          }
        } catch {
          // Ignore json parse error
        }
      };

      socket.onclose = () => {
        if (mounted) setWsConnected(false);
      };
      socket.onerror = () => {
        if (mounted) setWsConnected(false);
      };
    };
    connect().catch(() => {
      if (mounted) setWsConnected(false);
    });

    // Fallback sync polling every 5 seconds in case WebSocket drops
    const pollInterval = setInterval(() => {
      api.getDealRoomMessages(roomId, currentUserId).then((msgs) => {
        if (mounted && msgs.length > 0) {
          setMessages(msgs);
        }
      });
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      const open = wsRef.current;
      if (open && open.readyState === WebSocket.OPEN) {
        open.close();
      }
    };
  }, [roomId, currentUserId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    const sent = await api.sendDealRoomMessage(roomId, {
      sender_id: currentUserId,
      sender_role: role,
      sender_name: currentUserName,
      content,
    });

    if (sent) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      // Update room last message locally
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              last_message: content,
              last_message_at: new Date().toISOString(),
              messages_count: (prev.messages_count || 0) + 1,
            }
          : null
      );
    }
    setSending(false);
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "typing",
            user_id: currentUserId,
            user_name: currentUserName,
            is_typing: true,
          })
        );
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "typing",
                user_id: currentUserId,
                user_name: currentUserName,
                is_typing: false,
              })
            );
          }
        }, 2000);
      } catch {
        // Ignore WS send error
      }
    }
  };

  // Handle Sign NDA
  const handleSignNDA = async () => {
    if (!room) return;
    const updated = await api.signDealRoomNDA(roomId, {
      signer_id: currentUserId,
      signer_role: role,
      signer_name: currentUserName,
    });
    if (updated) {
      setRoom(updated);
      await fetchRoomData();
    }
  };

  // Handle Advance Stage
  const handleAdvanceStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    const updated = await api.updateDealRoomStage(roomId, {
      stage: newStage,
      note: stageNote,
      sender_id: currentUserId,
      sender_role: role,
      sender_name: currentUserName,
    });
    if (updated) {
      setRoom(updated);
      setShowStageModal(false);
      setStageNote("");
      await fetchRoomData();
    }
  };

  // Handle Share Document
  const handleShareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim() || !newDocUrl.trim()) return;

    const updated = await api.shareDealRoomDocument(roomId, {
      name: newDocName.trim(),
      url: newDocUrl.trim(),
      type: newDocType,
      size_kb: docSizeKb || 1240,
      sender_id: currentUserId,
      sender_role: role,
      sender_name: currentUserName,
    });

    if (updated) {
      setRoom(updated);
      setShowDocModal(false);
      setNewDocName("");
      setNewDocUrl("");
      await fetchRoomData();
    }
  };

  // Handle Export Legal Audit PDF Certificate
  const handleExportPdf = async () => {
    setExportingPdf(true);
    await api.downloadDealRoomPDF(roomId, room?.project_title || "DealRoom");
    setExportingPdf(false);
  };

  // Handle Export JSON Transcript
  const handleExportTranscript = async () => {
    setExporting(true);
    const transcript = await api.getDealRoomTranscript(roomId, currentUserId);
    setExporting(false);

    if (transcript) {
      // Trigger download of signed JSON file
      const blob = new Blob([JSON.stringify(transcript, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VentureX_Audit_Transcript_${room?.project_title?.replace(/\s+/g, "_") || "Room"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Open Audit Drawer
  const openAuditDrawer = async () => {
    setShowAuditDrawer(true);
    const logs = await api.getDealRoomAuditLogs(roomId);
    setAuditLogs(logs);
  };

  if (loading && !room) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1B3B6F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-xs text-[#64748B] font-medium">Entering Secure Deal Room...</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-elevated">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[#0F172A] font-display">Deal Room Not Found</h2>
          <p className="text-xs text-[#64748B] mt-1 mb-6">
            You do not have authorization or this room has not been initiated.
          </p>
          <Link
            href="/dealroom"
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-[#1B3B6F] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Deal Rooms
          </Link>
        </div>
      </div>
    );
  }

  const counterpartyName = role === "FOUNDER" ? room.investor_name : room.founder_name;
  const counterpartyRole = role === "FOUNDER" ? "Investor" : "Founder";
  const counterpartyEmail = role === "FOUNDER" ? room.investor_email : room.founder_email;
  const counterpartyFirm =
    role === "FOUNDER" ? room.investor_firm || "Venture Capital" : room.founder_company || "Startup Founder";

  const stages = [
    { id: "INTRO_ACCEPTED", label: "Intro Accepted" },
    { id: "DUE_DILIGENCE", label: "Due Diligence" },
    { id: "TERM_SHEET", label: "Term Sheet" },
    { id: "PARTNER_MEETING", label: "Partner Meeting" },
    { id: "CLOSED", label: "Closed" },
  ];

  const currentStageIndex = stages.findIndex((s) => s.id === room.stage);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* 1. Deal Room Navigation Header */}
      <header className="border-b border-[#E2E8F0] bg-white sticky top-0 z-30 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/dealroom?role=${role}`}
              className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
              title="Back to All Deal Rooms"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#0F172A] font-display flex items-center gap-2">
                  {room.project_title}
                  <span className="text-[#94A3B8] font-normal text-xs">•</span>
                  <span className="text-xs font-semibold text-[#1B3B6F]">{counterpartyName}</span>
                </h1>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {counterpartyFirm}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#64748B] flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${partnerOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {partnerOnline ? `${counterpartyName} is online` : `${counterpartyName} offline`}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Role switch toggle */}
            <div className="bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] flex items-center text-[11px]">
              <button
                onClick={() => setRole("FOUNDER")}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  role === "FOUNDER"
                    ? "bg-white text-[#0F172A] shadow-xs font-semibold"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Founder
              </button>
              <button
                onClick={() => setRole("INVESTOR")}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  role === "INVESTOR"
                    ? "bg-white text-[#0F172A] shadow-xs font-semibold"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Investor
              </button>
            </div>

            <button
              onClick={openAuditDrawer}
              className="py-1.5 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <History className="w-3.5 h-3.5 text-[#64748B]" />
              Activity
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="py-1.5 px-3 rounded-lg bg-[#1B3B6F] text-white text-xs font-semibold hover:bg-[#142C54] transition-colors flex items-center gap-1.5 shadow-subtle"
              title="Download this conversation as a PDF"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingPdf ? "Preparing PDF…" : "Download PDF"}
            </button>

          </div>
        </div>

        {/* 2. Interactive Deal Milestone Progress Bar */}
        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {stages.map((st, idx) => {
                const isPassed = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <div key={st.id} className="flex items-center">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        isCurrent
                          ? "bg-[#1B3B6F] text-white shadow-xs"
                          : isPassed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-[#94A3B8]"
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-current text-[9px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                      )}
                      {st.label}
                    </div>
                    {idx < stages.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] mx-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowStageModal(true)}
              className="text-xs font-semibold text-[#1B3B6F] hover:text-[#0F1E36] flex items-center gap-1 whitespace-nowrap"
            >
              <TrendingUp className="w-3.5 h-3.5" /> Advance Milestone
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: Diligence Vault (Left) & Direct Chat (Center/Right) */}
      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Diligence Escrow & Documents Vault (4 cols) */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Mutual NDA Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#1B3B6F]" />
                Confidentiality
              </span>
              {room.nda_signed ? (
                <Badge variant="success">NDA Executed</Badge>
              ) : (
                <Badge variant="warning">NDA Pending</Badge>
              )}
            </div>

            {room.nda_signed ? (
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Bilateral NDA Enforced
                </div>
                <p className="text-[11px] text-emerald-700">
                  Executed by {room.nda_signer_name || "both parties"}. Shared documents are covered by the NDA.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#64748B]">
                  Execute the VentureX Standard Mutual Non-Disclosure Agreement to unlock complete financial models and clinical audit data.
                </p>
                <button
                  onClick={handleSignNDA}
                  className="w-full py-2 px-3 rounded-lg bg-[#1B3B6F] hover:bg-[#152e57] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-subtle"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Sign Mutual NDA Digitally
                </button>
              </div>
            )}
          </div>

          {/* Shared Documents Vault */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1B3B6F]" />
                Data Room Vault ({(room.shared_documents || []).length})
              </span>
              <button
                onClick={() => setShowDocModal(true)}
                className="text-xs font-semibold text-[#1B3B6F] hover:underline"
              >
                + Share File
              </button>
            </div>

            <div className="space-y-2">
              {(room.shared_documents || []).length === 0 ? (
                <div className="p-4 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-xs text-[#64748B]">
                  No confidential files uploaded yet.
                </div>
              ) : (
                room.shared_documents?.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {doc.type === "cap_table" ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#1B3B6F] shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="font-semibold text-[#0F172A] truncate">{doc.name}</div>
                        <div className="text-[10px] text-[#64748B] uppercase tracking-wider">
                          {doc.type.replace("_", " ")} • {doc.size_kb ? `${doc.size_kb} KB` : "Link"}
                        </div>
                      </div>
                    </div>

                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-white transition-colors"
                      title="Download / View Document"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Direct contact: the other party's real sign-in email, when on file */}
          {counterpartyEmail && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                Direct Contact
              </span>
              <p className="text-[#64748B]">
                Want to set up a call? Email {counterpartyName || `the ${counterpartyRole.toLowerCase()}`} directly.
              </p>
              <a
                href={`mailto:${counterpartyEmail}`}
                className="py-2 px-3 rounded-lg border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#0F172A] font-semibold flex items-center justify-center gap-1.5 transition-colors w-full truncate"
              >
                <Mail className="w-3.5 h-3.5 text-[#1B3B6F] shrink-0" />
                <span className="truncate">{counterpartyEmail}</span>
              </a>
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: Full-Fledged Direct Conversation Thread (8 cols) */}
        <section className="lg:col-span-8 rounded-xl border border-[#E2E8F0] bg-white shadow-subtle flex flex-col h-[750px] overflow-hidden">
          {/* Conversation Header */}
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#FAFAFA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1B3B6F] text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {counterpartyName.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-bold text-[#0F172A]">{counterpartyName}</div>
                <div className="text-[10px] text-[#64748B]">{counterpartyFirm}</div>
              </div>
            </div>

          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#F8FAFC]/50">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8 text-xs text-[#64748B]">
                <div>
                  <div className="font-semibold text-[#0F172A]">No messages yet</div>
                  <p className="mt-1 max-w-xs mx-auto">Say hello to get the conversation started.</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = msg.sender_role === "SYSTEM";
                const isMe = msg.sender_id === currentUserId;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="max-w-md bg-amber-50/80 border border-amber-200 rounded-lg px-3.5 py-2 text-[11px] text-amber-900 text-center shadow-xs">
                        <div className="font-semibold flex items-center justify-center gap-1 mb-0.5">
                          <Lock className="w-3 h-3 text-amber-700" />
                          System Event
                        </div>
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-[#64748B]">
                      <span className="font-semibold text-[#0F172A]">{msg.sender_name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#E2E8F0] font-bold text-[#475569]">
                        {msg.sender_role}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">#{msg.sequence}</span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-subtle ${
                        isMe
                          ? "bg-[#1B3B6F] text-white rounded-tr-xs"
                          : "bg-white text-[#0F172A] border border-[#E2E8F0] rounded-tl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Message Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1.5">
                          {msg.attachments.map((att, aIdx) => (
                            <a
                              key={aIdx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors ${
                                isMe
                                  ? "bg-white/10 hover:bg-white/20 text-white"
                                  : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate font-medium">{att.name}</span>
                              </div>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-[#FAFAFA] border-t border-[#E2E8F0] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider shrink-0">
              Quick Actions:
            </span>
            <button
              onClick={() =>
                setNewMessage(
                  "We have updated our 24-month cash flow and financial model in the data room for your review."
                )
              }
              className="px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] text-[11px] shrink-0"
            >
              📊 Share Financial Update
            </button>
            <button
              onClick={() =>
                setNewMessage(
                  "Would you be open to an executive briefing call this Thursday at 2:00 PM EST?"
                )
              }
              className="px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] text-[11px] shrink-0"
            >
              📅 Propose Partner Meeting
            </button>
            <button
              onClick={() =>
                setNewMessage(
                  "Our investment committee is reviewing the preliminary term sheet terms. Expect our initial markup by tomorrow."
                )
              }
              className="px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] text-[11px] shrink-0"
            >
              📝 Term Sheet Dialogue
            </button>
          </div>

          {/* Real-time Typing Indicator */}
          {typingUser && (
            <div className="px-4 py-1.5 bg-[#F1F5F9] border-t border-[#E2E8F0] flex items-center gap-2 text-[11px] text-[#1B3B6F] font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#1B3B6F] animate-ping" />
              <span>{typingUser} is typing a message...</span>
            </div>
          )}

          {/* Message Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-[#E2E8F0] flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setShowDocModal(true)}
              className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
              title="Attach Confidential Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={`Send message as ${currentUserName} (${role})... (Encrypted & Recorded)`}
              className="flex-1 py-2 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3B6F]"
            />

            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="py-2 px-4 rounded-lg bg-[#1B3B6F] hover:bg-[#152e57] text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-subtle shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </section>
      </div>

      {/* MODAL 1: Share Confidential Document */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-elevated border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#0F172A] font-display">
                Share a document
              </h3>
              <button
                onClick={() => setShowDocModal(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleShareDocument} className="space-y-4 text-xs">
              {/* File Upload Zone */}
              <div className="p-4 bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] rounded-xl text-center space-y-2">
                <input
                  type="file"
                  id="dealroom-file-upload"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingDoc(true);
                    const uploaded = await api.uploadFile(file, "dealroom_attachment");
                    if (uploaded) {
                      setNewDocName(uploaded.original_name);
                      setNewDocUrl(uploaded.url);
                      setDocSizeKb(uploaded.size_kb);
                    }
                    setUploadingDoc(false);
                  }}
                />
                <label
                  htmlFor="dealroom-file-upload"
                  className="cursor-pointer inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1B3B6F] hover:bg-[#F1F5F9] shadow-xs transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {uploadingDoc ? "Uploading File..." : "Choose File from Computer (PDF, XLSX, DOCX)"}
                </label>
                <p className="text-[10px] text-[#64748B]">
                  Up to 25 MB.
                </p>
              </div>

              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="e.g., Q3_Financial_Projections_v2.xlsx"
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Document Type
                </label>
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value)}
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg"
                >
                  <option value="financial_model">Financial Model (Excel)</option>
                  <option value="pitch_deck">Pitch Deck (PDF)</option>
                  <option value="cap_table">Audited Cap Table</option>
                  <option value="clinical_data">Clinical / Technical Benchmark</option>
                  <option value="legal_agreement">Term Sheet / Legal Agreement</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Secure File URL
                </label>
                <input
                  type="text"
                  required
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  placeholder="https://… link to the file (Drive, Dropbox, DocSend…)"
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg font-mono text-[11px]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1B3B6F] text-white font-semibold shadow-subtle"
                >
                  Share & Record in Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Advance Deal Milestone */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-elevated border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#0F172A] font-display">
                Advance Deal Pipeline Milestone
              </h3>
              <button
                onClick={() => setShowStageModal(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdvanceStage} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Select Target Stage
                </label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg font-semibold text-[#0F172A]"
                >
                  <option value="INTRO_ACCEPTED">1. Intro Accepted</option>
                  <option value="DUE_DILIGENCE">2. Due Diligence</option>
                  <option value="TERM_SHEET">3. Term Sheet</option>
                  <option value="PARTNER_MEETING">4. Partner Meeting</option>
                  <option value="CLOSED">5. Deal Closed</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Milestone Note (Recorded in Audit Ledger)
                </label>
                <textarea
                  rows={3}
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  placeholder="e.g., Completed clinical hardware verification. Proceeding to formal partner IC vote."
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1B3B6F] text-white font-semibold shadow-subtle"
                >
                  Update & Record Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: room activity */}
      {showAuditDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full p-6 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] font-display">
                    Activity
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Everything that has happened in this room.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#64748B]">
                  Loading…
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1B3B6F] capitalize">
                        {String(log.event_type).replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#334155]">
                      Actor: <span className="font-semibold">{log.actor_name}</span> ({log.actor_role})
                    </div>

                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={handleExportTranscript}
                className="w-full py-2.5 rounded-lg bg-[#0F1E36] hover:bg-[#1E3A8A] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-subtle"
              >
                <Download className="w-4 h-4" />
                Download full history
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DealRoomDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#64748B]">Loading Deal Room...</div>}>
      <DealRoomDetailContent params={params} />
    </Suspense>
  );
}
