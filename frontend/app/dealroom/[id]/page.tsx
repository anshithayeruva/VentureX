"use client";

import React, { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileCheck,
  FileQuestion,
  FileText,
  History,
  Mail,
  Paperclip,
  Plus,
  Send,
  X,
} from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  LoadingRows,
  Tag,
  buttonClass,
  cx,
  inputClass,
} from "@/components/ui";
import { api, MeResponse } from "@/lib/api";
import { getApiToken } from "@/lib/auth/client";
import { DEAL_STAGES, stageLabel, stageTone } from "@/lib/dealroom";
import { timeAgo } from "@/lib/format";
import { DealMessage, DealRoom, DealRoomAuditLog } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DOC_TYPES = [
  { value: "pitch_deck", label: "Pitch deck" },
  { value: "financial_model", label: "Financial model" },
  { value: "cap_table", label: "Cap table" },
  { value: "clinical_data", label: "Technical or clinical data" },
  { value: "legal_agreement", label: "Term sheet or legal document" },
  { value: "other", label: "Other" },
];

function DealRoomContent({ params }: PageProps) {
  const { id: roomId } = use(params);
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"FOUNDER" | "INVESTOR">(searchParams.get("role") === "INVESTOR" ? "INVESTOR" : "FOUNDER");

  const [room, setRoom] = useState<DealRoom | null>(null);
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<DealRoomAuditLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const [showActivity, setShowActivity] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [busy, setBusy] = useState<"nda" | "stage" | "doc" | null>(null);

  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState("pitch_deck");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const [newStage, setNewStage] = useState("DUE_DILIGENCE");
  const [stageNote, setStageNote] = useState("");

  // Identity comes from the signed-in account; the backend also enforces it on every write.
  const [me, setMe] = useState<MeResponse | null>(null);
  const currentUserId = me?.id ?? "";
  const currentUserName = me?.name || me?.email || "You";

  useEffect(() => {
    let active = true;
    api
      .getMe()
      .then((account) => {
        if (!active || !account) return;
        setMe(account);
        if (account.role) setRole(account.role);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchRoomData = async () => {
    const r = await api.getDealRoom(roomId, currentUserId);
    if (r) setRoom(r);
    setMessages(await api.getDealRoomMessages(roomId, currentUserId));
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getDealRoom(roomId, currentUserId), api.getDealRoomMessages(roomId, currentUserId)])
      .then(([r, msgs]) => {
        if (!mounted) return;
        if (r) setRoom(r);
        setMessages(msgs);
      })
      .finally(() => mounted && setLoading(false));

    // Live updates over WebSocket. Browsers can't send an Authorization header on
    // WebSockets, so the short-lived token goes in the query string; the server
    // verifies it and checks the user belongs to this room.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http(s?):\/\//, "")
      : "localhost:8000";
    const baseWsUrl = `${protocol}//${host}/api/dealrooms/ws/${roomId}`;

    const connect = async () => {
      const token = await getApiToken();
      if (!mounted || !token) return;
      const socket = new WebSocket(`${baseWsUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = socket;
      socket.onmessage = (event) => {
        if (!mounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "message" && payload.data) {
            const incoming: DealMessage = payload.data;
            setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          } else if (payload.type === "typing" && payload.user_id !== currentUserId) {
            setTypingUser(payload.is_typing ? payload.user_name : null);
            if (payload.is_typing) setTimeout(() => setTypingUser(null), 3000);
          } else if (payload.type === "presence") {
            setPartnerOnline(payload.event === "joined");
          }
        } catch {
          // ignore malformed frames
        }
      };
    };
    connect().catch(() => {});

    // Polling fallback in case the socket drops.
    const poll = setInterval(() => {
      api.getDealRoomMessages(roomId, currentUserId).then((msgs) => {
        if (mounted && msgs.length > 0) setMessages(msgs);
      });
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(poll);
      const open = wsRef.current;
      if (open && open.readyState === WebSocket.OPEN) open.close();
    };
  }, [roomId, currentUserId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  /* ---------- actions ---------- */

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);
    const sent = await api.sendDealRoomMessage(roomId, {
      sender_id: currentUserId,
      sender_role: role,
      sender_name: currentUserName,
      content,
    });
    if (sent) setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    setSending(false);
  };

  const onDraftChange = (text: string) => {
    setDraft(text);
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "typing", user_id: currentUserId, user_name: currentUserName, is_typing: true }));
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: "typing", user_id: currentUserId, user_name: currentUserName, is_typing: false })
          );
        }
      }, 2000);
    } catch {
      // ignore
    }
  };

  const signNda = async () => {
    setBusy("nda");
    const updated = await api.signDealRoomNDA(roomId, {
      signer_id: currentUserId,
      signer_role: role,
      signer_name: currentUserName,
    });
    if (updated) {
      setRoom(updated);
      await fetchRoomData();
    }
    setBusy(null);
  };

  const changeStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("stage");
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
    setBusy(null);
  };

  const resetDocForm = () => {
    setDocName("");
    setDocUrl("");
    setDocFile(null);
    setDocError(null);
  };

  // A file is uploaded privately to the room (only its two members can download it);
  // otherwise the founder or investor shares an https link.
  const shareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = docName.trim();
    if (!name) return;
    if (!docFile && !/^https?:\/\//i.test(docUrl.trim())) {
      setDocError("Choose a file, or paste a link that starts with https://");
      return;
    }
    setBusy("doc");
    setDocError(null);
    try {
      const updated = docFile
        ? await api.uploadDealRoomFile(roomId, docFile, name, docType)
        : await api.shareDealRoomDocument(roomId, {
            name,
            url: docUrl.trim(),
            type: docType,
            sender_id: currentUserId,
            sender_role: role,
            sender_name: currentUserName,
          });
      if (updated) {
        setRoom(updated);
        setShowDocModal(false);
        resetDocForm();
        await fetchRoomData();
      } else {
        setDocError("Couldn't share that. Please try again.");
      }
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Couldn't share that. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setExportingPdf(true);
    try {
      await api.downloadDealRoomPDF(roomId, room?.project_title || "Deal room");
    } finally {
      setExportingPdf(false);
    }
  };

  const downloadHistory = async () => {
    const transcript = await api.getDealRoomTranscript(roomId, currentUserId);
    if (!transcript) return;
    const blob = new Blob([JSON.stringify(transcript, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VentureX_${room?.project_title?.replace(/\s+/g, "_") || "deal_room"}_history.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openActivity = async () => {
    setShowActivity(true);
    setAuditLogs(null);
    setAuditLogs(await api.getDealRoomAuditLogs(roomId));
  };

  /* ---------- render ---------- */

  if (loading || !room) {
    return (
      <PortalLayout role={role} activeItem={role === "INVESTOR" ? "dealflow" : "dealrooms"} title="Deal room">
        {loading ? (
          <LoadingRows />
        ) : (
          <EmptyState
            icon={FileQuestion}
            title="Deal room not found"
            description="It may not exist, or you're not one of its members."
            action={<ButtonLink href={role === "INVESTOR" ? "/investor/deal-flow" : "/dealroom"}>{role === "INVESTOR" ? "Back to deal flow" : "Back to deal rooms"}</ButtonLink>}
          />
        )}
      </PortalLayout>
    );
  }

  const otherName = role === "FOUNDER" ? room.investor_name : room.founder_name;
  const otherOrg = role === "FOUNDER" ? room.investor_firm : room.founder_company;
  const otherEmail = role === "FOUNDER" ? room.investor_email : room.founder_email;
  const stageIndex = DEAL_STAGES.findIndex((s) => s.id === room.stage);
  const documents = room.shared_documents || [];

  return (
    <PortalLayout role={role} activeItem={role === "INVESTOR" ? "dealflow" : "dealrooms"} title={room.project_title}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link href={role === "INVESTOR" ? "/investor/deal-flow" : "/dealroom"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            {role === "INVESTOR" ? "Deal Flow" : "Deal rooms"}
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] leading-tight font-medium text-ink">{room.project_title}</h1>
                <Tag tone={stageTone(room.stage)}>{stageLabel(room.stage)}</Tag>
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                <span className={cx("h-2 w-2 rounded-full", partnerOnline ? "bg-positive" : "bg-line-strong")} />
                With {otherName}
                {otherOrg ? ` · ${otherOrg}` : ""}
                {partnerOnline ? " · online" : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" onClick={openActivity}>
                <History className="h-4 w-4" />
                Activity
              </Button>
              <Button variant="secondary" onClick={downloadPdf} disabled={exportingPdf}>
                <Download className="h-4 w-4" />
                {exportingPdf ? "Preparing…" : "Download PDF"}
              </Button>
              <Button
                onClick={() => {
                  const next = DEAL_STAGES[Math.min(stageIndex + 1, DEAL_STAGES.length - 1)];
                  setNewStage(next?.id || "DUE_DILIGENCE");
                  setShowStageModal(true);
                }}
              >
                Update stage
              </Button>
            </div>
          </div>
        </div>

        {/* Stage progress */}
        <ol className="grid grid-cols-5 gap-2">
          {DEAL_STAGES.map((s, i) => {
            const done = stageIndex >= 0 && i <= stageIndex;
            return (
              <li key={s.id}>
                <div className={cx("h-1.5 rounded-full", done ? "bg-accent" : "bg-subtle")} />
                <div className={cx("mt-1.5 hidden text-xs sm:block", i === stageIndex ? "font-medium text-ink" : "text-muted")}>
                  {s.label}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Conversation */}
          <Card padded={false} className="flex h-[640px] flex-col lg:col-span-2">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-medium text-ink">No messages yet</p>
                    <p className="mt-1 text-sm text-muted">Say hello to get the conversation started.</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.sender_role === "SYSTEM") {
                    return (
                      <div key={msg.id} className="text-center text-xs text-muted">
                        {msg.content}
                        <span className="text-faint"> · {timeAgo(msg.created_at)}</span>
                      </div>
                    );
                  }
                  const mine = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
                      <div className="mb-1 text-xs text-muted">
                        {mine ? "You" : msg.sender_name} · {timeAgo(msg.created_at)}
                      </div>
                      <div
                        className={cx(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                          mine ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md bg-subtle text-ink"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments?.map((att, i) => (
                          <DocLink
                            key={i}
                            url={att.url}
                            name={att.name}
                            className={cx(
                              "mt-2 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs",
                              mine ? "bg-white/15 hover:bg-white/25" : "bg-surface hover:bg-canvas"
                            )}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{att.name}</span>
                          </DocLink>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {typingUser && <div className="px-5 pb-1 text-xs text-muted">{typingUser} is typing…</div>}
            <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-line p-3">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Message ${otherName}`}
                className={cx(inputClass, "max-h-40 min-h-[40px] resize-none")}
              />
              <button type="submit" disabled={!draft.trim() || sending} className={buttonClass("primary", "h-10 shrink-0")} aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Card>

          {/* Side panel */}
          <div className="space-y-6">
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-ink">NDA</h2>
                {room.nda_signed ? <Tag tone="positive">Signed</Tag> : <Tag tone="warning">Not signed</Tag>}
              </div>
              {room.nda_signed ? (
                <p className="text-sm text-muted">
                  Signed by {room.nda_signer_name || "both parties"}
                  {room.nda_signed_at ? ` · ${timeAgo(room.nda_signed_at)}` : ""}. Documents shared here are covered by it.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted">Sign the standard mutual NDA before sharing sensitive documents.</p>
                  <Button className="w-full" onClick={signNda} disabled={busy === "nda"}>
                    <FileCheck className="h-4 w-4" />
                    {busy === "nda" ? "Signing…" : "Sign NDA"}
                  </Button>
                </>
              )}
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-ink">Documents</h2>
                <Button variant="ghost" onClick={() => setShowDocModal(true)}>
                  <Plus className="h-4 w-4" />
                  Share
                </Button>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-muted">Nothing shared yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {documents.map((doc, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{doc.name}</div>
                        <div className="text-xs text-muted">
                          {DOC_TYPES.find((t) => t.value === doc.type)?.label ?? "Document"}
                          {doc.size_kb ? ` · ${doc.size_kb} KB` : ""}
                        </div>
                      </div>
                      <DocLink
                        url={doc.url}
                        name={doc.name}
                        className="rounded-md p-1.5 text-faint hover:bg-subtle hover:text-ink"
                        label={`Open ${doc.name}`}
                      >
                        {api.isDealRoomFile(doc.url) ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                      </DocLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-medium text-ink">{role === "FOUNDER" ? "Investor" : "Founder"}</h2>
              <div className="flex items-center gap-3">
                <Avatar name={otherName} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{otherName}</div>
                  {otherOrg && <div className="truncate text-sm text-muted">{otherOrg}</div>}
                </div>
              </div>
              {otherEmail && (
                <a href={`mailto:${otherEmail}`} className={buttonClass("secondary", "w-full")}>
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{otherEmail}</span>
                </a>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Share a document */}
      {showDocModal && (
        <Modal
          title="Share a document"
          onClose={() => {
            setShowDocModal(false);
            resetDocForm();
          }}
        >
          <form onSubmit={shareDocument} className="space-y-4">
            <div>
              <input
                id="room-file"
                type="file"
                accept=".pdf,.pptx,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 25 * 1024 * 1024) {
                    setDocError("The file must be 25 MB or smaller.");
                    return;
                  }
                  setDocFile(file);
                  setDocError(null);
                  if (!docName.trim()) setDocName(file.name);
                }}
              />
              <label
                htmlFor="room-file"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 hover:bg-canvas"
              >
                {docFile ? <Check className="h-5 w-5 text-positive" /> : <Paperclip className="h-5 w-5 text-faint" />}
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium text-ink">{docFile ? docFile.name : "Upload a file"}</span>
                  <span className="block text-muted">
                    {docFile
                      ? `${Math.max(1, Math.round(docFile.size / 1024))} KB · only you and ${otherName} can open it`
                      : "Up to 25 MB. Only the two of you can open it. Or paste a link below."}
                  </span>
                </span>
              </label>
              {docFile && (
                <button type="button" onClick={() => setDocFile(null)} className="mt-1.5 text-sm text-muted hover:text-ink">
                  Remove file
                </button>
              )}
            </div>
            <Field label="Name" htmlFor="doc-name">
              <input id="doc-name" required className={inputClass} value={docName} onChange={(e) => setDocName(e.target.value)} />
            </Field>
            <Field label="Type" htmlFor="doc-type">
              <select id="doc-type" className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            {!docFile && (
              <Field label="Link" htmlFor="doc-url">
                <input
                  id="doc-url"
                  type="url"
                  className={inputClass}
                  placeholder="https://… (Drive, Dropbox, DocSend)"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                />
              </Field>
            )}
            {docError && (
              <p role="alert" className="text-sm text-danger">
                {docError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDocModal(false);
                  resetDocForm();
                }}
              >
                Cancel
              </Button>
              <button type="submit" className={buttonClass("primary")} disabled={busy === "doc"}>
                {busy === "doc" ? "Sharing…" : "Share"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Update stage */}
      {showStageModal && (
        <Modal title="Update stage" onClose={() => setShowStageModal(false)}>
          <form onSubmit={changeStage} className="space-y-4">
            <Field label="Stage" htmlFor="stage">
              <select id="stage" className={inputClass} value={newStage} onChange={(e) => setNewStage(e.target.value)}>
                {DEAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
                <option value="PASSED">Passed</option>
              </select>
            </Field>
            <Field label="Note" htmlFor="stage-note" hint="Optional. Shown in the conversation.">
              <textarea id="stage-note" rows={3} className={inputClass} value={stageNote} onChange={(e) => setStageNote(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowStageModal(false)}>
                Cancel
              </Button>
              <button type="submit" className={buttonClass("primary")} disabled={busy === "stage"}>
                {busy === "stage" ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Activity */}
      {showActivity && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={() => setShowActivity(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-surface shadow-elevated"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Activity"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-lg font-medium text-ink">Activity</h2>
                <p className="text-sm text-muted">Everything that has happened in this room.</p>
              </div>
              <button type="button" onClick={() => setShowActivity(false)} className="rounded-md p-1.5 text-muted hover:bg-subtle" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {auditLogs == null ? (
                <LoadingRows />
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-muted">No activity yet.</p>
              ) : (
                <ol className="space-y-4">
                  {auditLogs.map((log) => (
                    <li key={log.id} className="text-sm">
                      <div className="font-medium capitalize text-ink">
                        {String(log.event_type).replace(/_/g, " ").toLowerCase()}
                      </div>
                      <div className="text-muted">
                        {log.actor_name} · {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="border-t border-line p-4">
              <Button variant="secondary" className="w-full" onClick={downloadHistory}>
                <Download className="h-4 w-4" />
                Download full history
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

/** A shared document: a private room file downloads with the user's token; an external link opens in a new tab. */
function DocLink({
  url,
  name,
  className,
  label,
  children,
}: {
  url: string;
  name: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  if (api.isDealRoomFile(url)) {
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        title="Download"
        onClick={() => api.downloadDealRoomFile(url, name).catch((e: Error) => window.alert(e.message))}
      >
        {children}
      </button>
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    // Older uploads that were stored publicly are no longer served.
    return (
      <span className={cx(className, "opacity-60")} title="This file is no longer available">
        {children}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-subtle" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DealRoomPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <DealRoomContent params={params} />
    </Suspense>
  );
}
