"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCheck,
  LifeBuoy,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmojiPicker } from "@/components/support/emoji-picker";
import { useAuthStore } from "@/store/auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { useSupportTicketStore } from "@/store/support-ticket-store";
import { useNotificationStore } from "@/store/notification-store";
import { revalidateDomainResources } from "@/lib/domain-data-loader";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types";

const MAX_ATTACHMENT_BYTES = 1_500_000;

const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  BUG: "Bug report",
  FEATURE: "Feature request",
};

const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const STATUS_VARIANT: Record<
  SupportTicketStatus,
  "default" | "secondary" | "outline" | "success" | "warning"
> = {
  OPEN: "warning",
  IN_PROGRESS: "default",
  WAITING_ON_CUSTOMER: "secondary",
  RESOLVED: "success",
  CLOSED: "outline",
};

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read recording"));
    reader.readAsDataURL(blob);
  });
}

function chatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  return formatDate(dateStr);
}

export default function SupportPage() {
  const user = useAuthStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);
  const tickets = useSupportTicketStore((s) => s.tickets);
  const addTicket = useSupportTicketStore((s) => s.addTicket);
  const appendMessage = useSupportTicketStore((s) => s.appendMessage);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [reply, setReply] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<SupportTicketAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyRecording, setReplyRecording] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("BUG");
  const [priority, setPriority] = useState<SupportTicketPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<SupportTicketAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const replyRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const replyChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return sortedTickets;
    return sortedTickets.filter((t) => {
      const last = t.messages[t.messages.length - 1];
      const hay = [t.subject, t.description, last?.body ?? "", t.status]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedTickets, listSearch]);

  const selected = useMemo(
    () => sortedTickets.find((t) => t.id === selectedId) ?? null,
    [sortedTickets, selectedId]
  );

  useEffect(() => {
    if (!selectedId && sortedTickets[0]) {
      setSelectedId(sortedTickets[0].id);
      return;
    }
    if (selectedId && !sortedTickets.some((t) => t.id === selectedId)) {
      setSelectedId(sortedTickets[0]?.id ?? null);
    }
  }, [sortedTickets, selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length, selectedId]);

  useEffect(() => {
    const tick = () => {
      void revalidateDomainResources(["supportTickets"]);
    };
    const id = window.setInterval(tick, 12_000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!emojiOpen) return;
    function onDown(e: MouseEvent) {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [emojiOpen]);

  const resetCreateForm = () => {
    setSubject("");
    setCategory("BUG");
    setPriority("MEDIUM");
    setDescription("");
    setAttachments([]);
    setRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const addFiles = async (
    files: FileList | null,
    target: "create" | "reply" = "create"
  ) => {
    if (!files?.length) return;
    const next: SupportTicketAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is too large`, {
          description: "Keep each file under ~1.5 MB.",
        });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({
          id: newId("att"),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          kind: "file",
        });
      } catch {
        toast.error(`Could not attach ${file.name}`);
      }
    }
    if (!next.length) return;
    if (target === "reply") {
      setReplyAttachments((prev) => [...prev, ...next].slice(0, 5));
    } else {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  const startRecording = async (target: "create" | "reply" = "create") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice notes are not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = target === "reply" ? replyChunksRef : chunksRef;
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          toast.error("Voice note is too large");
          return;
        }
        void blobToDataUrl(blob).then((dataUrl) => {
          const item: SupportTicketAttachment = {
            id: newId("voice"),
            name: `voice-note-${new Date().toISOString().slice(0, 19)}.webm`,
            mimeType: "audio/webm",
            size: blob.size,
            dataUrl,
            kind: "voice",
          };
          if (target === "reply") {
            setReplyAttachments((prev) => [...prev, item].slice(0, 5));
          } else {
            setAttachments((prev) => [...prev, item]);
          }
        });
      };
      if (target === "reply") {
        replyRecorderRef.current = recorder;
        setReplyRecording(true);
      } else {
        mediaRecorderRef.current = recorder;
        setRecording(true);
      }
      recorder.start();
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = (target: "create" | "reply" = "create") => {
    if (target === "reply") {
      replyRecorderRef.current?.stop();
      replyRecorderRef.current = null;
      setReplyRecording(false);
      return;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const insertEmoji = (emoji: string) => {
    const el = replyInputRef.current;
    if (!el) {
      setReply((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? reply.length;
    const end = el.selectionEnd ?? reply.length;
    const next = reply.slice(0, start) + emoji + reply.slice(end);
    setReply(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString();
    const authorName = user?.name?.trim() || "Workshop";
    const ticketId = newId("tkt");
    const workshopMsg: SupportTicketMessage = {
      id: newId("msg"),
      author: "WORKSHOP",
      authorName,
      body: description.trim(),
      createdAt: now,
      attachmentIds: attachments.map((a) => a.id),
    };
    const ack: SupportTicketMessage = {
      id: newId("msg"),
      author: "SUPPORT",
      authorName: "MY DETAIL OS Support",
      body: "Thanks for reaching out. Your ticket is in our Support inbox — the team will reply in this thread.",
      createdAt: new Date(Date.now() + 500).toISOString(),
    };
    const ticket: SupportTicket = {
      id: ticketId,
      subject: subject.trim(),
      category,
      priority,
      description: description.trim(),
      status: "OPEN",
      createdByUserId: user?.id,
      createdByName: authorName,
      organizationId: user?.organizationId,
      organizationName: businessName?.trim() || undefined,
      attachments,
      messages: [workshopMsg, ack],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await addTicket(ticket);
      useNotificationStore.getState().addNotification({
        type: "system",
        title: "Support ticket created",
        message: ticket.subject,
        href: "/support",
      });
      toast.success("Ticket submitted");
      setCreateOpen(false);
      resetCreateForm();
      setSelectedId(ticketId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selected) return;
    if (!reply.trim() && replyAttachments.length === 0) return;
    setReplySending(true);
    setEmojiOpen(false);
    const message: SupportTicketMessage = {
      id: newId("msg"),
      author: "WORKSHOP",
      authorName: user?.name?.trim() || "Workshop",
      body:
        reply.trim() ||
        (replyAttachments.some((a) => a.kind === "voice" || a.mimeType.startsWith("audio/"))
          ? "🎤 Voice note"
          : "📎 Attachment"),
      createdAt: new Date().toISOString(),
      attachmentIds: replyAttachments.map((a) => a.id),
    };
    try {
      await appendMessage(selected.id, message, replyAttachments);
      setReply("");
      setReplyAttachments([]);
      replyInputRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reply");
    } finally {
      setReplySending(false);
    }
  };

  const canSend = Boolean(reply.trim() || replyAttachments.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4">
      <div className="shrink-0">
        <PageHeader
          title="Help & Support"
          description="Report issues or chat with our support team."
          hideDescriptionOnMobile
          inlineActionsOnMobile
          actions={
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New ticket
            </Button>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        {/* Chat list */}
        <aside className="flex max-h-[38vh] min-h-0 flex-col overflow-hidden border-b border-border lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="shrink-0 space-y-2.5 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">Chats</h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {sortedTickets.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search or start a new chat"
                className="h-9 bg-muted/50 pl-8"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-card">
            {filteredTickets.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">
                  {sortedTickets.length === 0 ? "No tickets yet" : "No matches"}
                </p>
                {sortedTickets.length === 0 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      resetCreateForm();
                      setCreateOpen(true);
                    }}
                  >
                    Create one
                  </button>
                ) : null}
              </div>
            ) : (
              filteredTickets.map((t) => {
                const active = t.id === selectedId;
                const last = t.messages[t.messages.length - 1];
                const waitingOnUs = last?.author === "SUPPORT";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(t.id);
                      setEmojiOpen(false);
                      setReplyAttachments([]);
                    }}
                    className={cn(
                      "flex w-full gap-3 border-b border-border/70 px-3.5 py-3 text-left transition-colors",
                      active ? "bg-muted/70" : "hover:bg-muted/40"
                    )}
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {getInitials(t.subject)}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-[15px]",
                            waitingOnUs ? "font-bold" : "font-medium"
                          )}
                        >
                          {t.subject}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-[11px]",
                            waitingOnUs ? "font-semibold text-primary" : "text-muted-foreground"
                          )}
                        >
                          {chatTime(last?.createdAt ?? t.updatedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-[13px]",
                            waitingOnUs ? "font-medium text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {last?.author === "WORKSHOP" ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                              {last.body}
                            </span>
                          ) : (
                            last?.body || CATEGORY_LABEL[t.category]
                          )}
                        </p>
                        {waitingOnUs ? (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                            {Math.max(1, t.messages.filter((m) => m.author === "SUPPORT").length)}
                          </span>
                        ) : (
                          <Badge
                            variant={STATUS_VARIANT[t.status]}
                            className="shrink-0 text-[9px]"
                          >
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          {!selected ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LifeBuoy className="h-6 w-6" />
              </span>
              <p className="text-base font-medium">MY DETAIL OS Support</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Select a ticket on the left to view the conversation, or create a new one.
              </p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  OS
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold">{selected.subject}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {CATEGORY_LABEL[selected.category]} · {PRIORITY_LABEL[selected.priority]} ·{" "}
                    {selected.messages.length} messages
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[selected.status]}>
                  {selected.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-background px-[4%] py-3 sm:px-[7%]">
                {selected.description ? (
                  <div className="mb-3 flex justify-center">
                    <div className="max-w-md rounded-lg border border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
                      <strong className="text-foreground">Ticket:</strong> {selected.description}
                    </div>
                  </div>
                ) : null}

                {selected.messages.map((m, idx) => {
                  const mine = m.author === "WORKSHOP";
                  const linked = (m.attachmentIds ?? [])
                    .map((id) => selected.attachments.find((a) => a.id === id))
                    .filter(Boolean) as SupportTicketAttachment[];
                  const isLast = idx === selected.messages.length - 1;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[min(85%,520px)] px-2.5 pb-1 pt-1.5 text-sm shadow-none",
                          mine
                            ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-2xl rounded-bl-sm border border-border bg-card text-foreground"
                        )}
                      >
                        {!mine ? (
                          <p className="mb-0.5 text-[11px] font-bold text-primary">
                            {m.authorName}
                          </p>
                        ) : null}
                        {linked.length > 0 ? (
                          <ul className="mb-1 space-y-1.5">
                            {linked.map((a) => (
                              <li key={a.id}>
                                {a.mimeType.startsWith("image/") ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={a.dataUrl}
                                    alt={a.name}
                                    className="max-h-48 rounded-lg"
                                  />
                                ) : a.kind === "voice" || a.mimeType.startsWith("audio/") ? (
                                  <audio controls src={a.dataUrl} className="max-w-full" />
                                ) : (
                                  <a
                                    href={a.dataUrl}
                                    download={a.name}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 text-xs underline",
                                      mine ? "text-primary-foreground" : "text-primary"
                                    )}
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {a.name}
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {m.body &&
                        m.body !== "📎 Attachment" &&
                        m.body !== "🎤 Voice note" ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        ) : !linked.length ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        ) : null}
                        <div
                          className={cn(
                            "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                            mine ? "text-primary-foreground/75" : "text-muted-foreground"
                          )}
                        >
                          <span>{chatTime(m.createdAt)}</span>
                          {mine ? (
                            <CheckCheck
                              className={cn(
                                "h-3.5 w-3.5",
                                isLast ? "text-sky-200" : "opacity-70"
                              )}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {/* Composer */}
              <div className="relative shrink-0 border-t border-border bg-card px-2.5 py-2 sm:px-3">
                {replyAttachments.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {replyAttachments.map((a) => (
                      <div
                        key={a.id}
                        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-2 py-1.5 text-xs"
                      >
                        {a.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.dataUrl}
                            alt=""
                            className="h-7 w-7 rounded object-cover"
                          />
                        ) : a.kind === "voice" || a.mimeType.startsWith("audio/") ? (
                          <Mic className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        <button
                          type="button"
                          aria-label="Remove attachment"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setReplyAttachments((prev) => prev.filter((x) => x.id !== a.id))
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {emojiOpen ? (
                  <div
                    ref={emojiWrapRef}
                    className="absolute bottom-full left-2 z-30 mb-2 sm:left-3"
                  >
                    <EmojiPicker
                      onPick={insertEmoji}
                      onClose={() => setEmojiOpen(false)}
                    />
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  <div className="flex min-h-12 flex-1 items-end gap-0.5 rounded-3xl border border-border bg-muted/40 px-1 py-1">
                    <input
                      ref={replyFileInputRef}
                      type="file"
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void addFiles(e.target.files, "reply");
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Attach file"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => replyFileInputRef.current?.click()}
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Emoji"
                      aria-pressed={emojiOpen}
                      className={cn(
                        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted",
                        emojiOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setEmojiOpen((v) => !v)}
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <textarea
                      ref={replyInputRef}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type a message"
                      rows={1}
                      className="max-h-28 min-h-7 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendReply();
                        }
                      }}
                    />
                  </div>
                  {canSend ? (
                    <Button
                      type="button"
                      size="icon"
                      className="h-12 w-12 shrink-0 rounded-full"
                      disabled={replySending}
                      onClick={() => void sendReply()}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      className={cn(
                        "h-12 w-12 shrink-0 rounded-full",
                        replyRecording && "bg-destructive hover:bg-destructive/90"
                      )}
                      aria-label={replyRecording ? "Stop recording" : "Record voice note"}
                      onClick={() =>
                        replyRecording
                          ? stopRecording("reply")
                          : void startRecording("reply")
                      }
                    >
                      {replyRecording ? (
                        <MicOff className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Create ticket */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            stopRecording("create");
            resetCreateForm();
          }
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-lg")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Create support ticket</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="tkt-subject">Subject</Label>
              <Input
                id="tkt-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                className="h-9"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as SupportTicketCategory)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUG">Bug report</SelectItem>
                    <SelectItem value="FEATURE">Feature request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as SupportTicketPriority)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tkt-desc">Description</Label>
              <Textarea
                id="tkt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue in detail…"
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments & voice note (optional)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-2 border-dashed py-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span className="text-left text-xs">Add image / video / doc</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto justify-start gap-2 border-dashed py-3",
                    recording && "border-destructive/50 text-destructive"
                  )}
                  onClick={() =>
                    recording ? stopRecording("create") : void startRecording("create")
                  }
                >
                  {recording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-left text-xs">
                    {recording ? "Stop recording" : "Record voice note"}
                  </span>
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files, "create");
                  e.target.value = "";
                }}
              />
              {attachments.length > 0 ? (
                <ul className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-2">
                  {attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                        }
                        aria-label={`Remove ${a.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitTicket()}
              disabled={submitting || !subject.trim() || !description.trim()}
            >
              {submitting ? "Submitting…" : "Submit ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
