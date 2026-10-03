"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LifeBuoy,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Send,
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
import { useAuthStore } from "@/store/auth-store";
import { useSupportTicketStore } from "@/store/support-ticket-store";
import { useNotificationStore } from "@/store/notification-store";
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
};

const STATUS_VARIANT: Record<
  SupportTicketStatus,
  "default" | "secondary" | "outline" | "success" | "warning"
> = {
  OPEN: "warning",
  IN_PROGRESS: "default",
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

export default function SupportPage() {
  const user = useAuthStore((s) => s.user);
  const tickets = useSupportTicketStore((s) => s.tickets);
  const addTicket = useSupportTicketStore((s) => s.addTicket);
  const appendMessage = useSupportTicketStore((s) => s.appendMessage);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [replySending, setReplySending] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("BUG");
  const [priority, setPriority] = useState<SupportTicketPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<SupportTicketAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tickets]
  );

  const selected = useMemo(
    () => sortedTickets.find((t) => t.id === selectedId) ?? null,
    [sortedTickets, selectedId]
  );

  useEffect(() => {
    if (selectedId && !sortedTickets.some((t) => t.id === selectedId)) {
      setSelectedId(sortedTickets[0]?.id ?? null);
    }
  }, [sortedTickets, selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length, selectedId]);

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

  const addFiles = async (files: FileList | null) => {
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
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice notes are not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          toast.error("Voice note is too large");
          return;
        }
        void blobToDataUrl(blob).then((dataUrl) => {
          setAttachments((prev) => [
            ...prev,
            {
              id: newId("voice"),
              name: `voice-note-${new Date().toISOString().slice(0, 19)}.webm`,
              mimeType: "audio/webm",
              size: blob.size,
              dataUrl,
              kind: "voice",
            },
          ]);
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
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
      body: "Thanks for reaching out. We’ve received your ticket and will reply here shortly.",
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
    if (!selected || !reply.trim()) return;
    setReplySending(true);
    const message: SupportTicketMessage = {
      id: newId("msg"),
      author: "WORKSHOP",
      authorName: user?.name?.trim() || "Workshop",
      body: reply.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await appendMessage(selected.id, message);
      setReply("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reply");
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
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

      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        {/* Ticket list */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold tracking-tight">Your tickets</h2>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {sortedTickets.length} total
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sortedTickets.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No tickets yet</p>
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
              </div>
            ) : (
              <ul className="space-y-0.5">
                {sortedTickets.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                          active
                            ? "bg-primary/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent)]"
                            : "hover:bg-muted/70"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">
                            {t.subject}
                          </p>
                          <Badge
                            variant={STATUS_VARIANT[t.status]}
                            className="shrink-0 text-[10px]"
                          >
                            {t.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {CATEGORY_LABEL[t.category]} · {PRIORITY_LABEL[t.priority]} ·{" "}
                          {formatDate(t.updatedAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Conversation */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Select a ticket</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Choose a ticket on the left to view the conversation, or create a new
                one.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-border/70 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight sm:text-base">
                      {selected.subject}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CATEGORY_LABEL[selected.category]} ·{" "}
                      {PRIORITY_LABEL[selected.priority]} · Opened{" "}
                      {formatDate(selected.createdAt)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[selected.status]}>
                    {selected.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5">
                {selected.messages.map((m) => {
                  const mine = m.author === "WORKSHOP";
                  const linked = (m.attachmentIds ?? [])
                    .map((id) => selected.attachments.find((a) => a.id === id))
                    .filter(Boolean) as SupportTicketAttachment[];
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}
                    >
                      {!mine ? (
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          OS
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                          mine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md border border-border/70 bg-card"
                        )}
                      >
                        <p
                          className={cn(
                            "mb-1 text-[10px] font-medium",
                            mine ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}
                        >
                          {m.authorName}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        {linked.length > 0 ? (
                          <ul className="mt-2 space-y-1.5">
                            {linked.map((a) => (
                              <li key={a.id}>
                                {a.mimeType.startsWith("image/") ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={a.dataUrl}
                                    alt={a.name}
                                    className="max-h-40 rounded-lg border border-black/10"
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
                        <p
                          className={cn(
                            "mt-1.5 text-[10px]",
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {formatDate(m.createdAt)}
                        </p>
                      </div>
                      {mine ? (
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                          {getInitials(m.authorName)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              <div className="border-t border-border/70 p-3 sm:p-4">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    className="min-h-[44px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    disabled={!reply.trim() || replySending}
                    onClick={() => void sendReply()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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
            stopRecording();
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
                  <span className="text-left text-xs">
                    Add image / video / doc
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto justify-start gap-2 border-dashed py-3",
                    recording && "border-destructive/50 text-destructive"
                  )}
                  onClick={() => (recording ? stopRecording() : void startRecording())}
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
                  void addFiles(e.target.files);
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
