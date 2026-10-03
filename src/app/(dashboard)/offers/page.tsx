"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, Megaphone, Pencil, Search, Send, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomerStore } from "@/store/customer-store";
import { useOfferStore } from "@/store/offer-store";
import { useSettingsStore } from "@/store/settings-store";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import {
  OFFER_CUSTOMER_NAME_PLACEHOLDER,
  buildOfferBroadcastWhatsAppMessage,
  personalizeOfferWhatsAppMessage,
} from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { OfferBroadcast } from "@/types";

const SEND_DELAY_MS = 350;
const PREVIEW_SAMPLE_NAME = "Customer";

function newOfferId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `offer-${crypto.randomUUID()}`;
  }
  return `offer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Render WhatsApp-style *bold*, _italic_, and ~strike~ for preview. */
function formatWhatsAppMarkup(text: string, keyPrefix = "m"): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const inner = token.slice(1, -1);
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("*")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {inner}
        </strong>
      );
    } else if (token.startsWith("_")) {
      nodes.push(
        <em key={key} className="italic">
          {inner}
        </em>
      );
    } else {
      nodes.push(
        <span key={key} className="line-through">
          {inner}
        </span>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function WhatsAppMessagePreview({ text }: { text: string }) {
  const personalized = personalizeOfferWhatsAppMessage(text, PREVIEW_SAMPLE_NAME);
  const lines = personalized.length > 0 ? personalized.split("\n") : [""];
  return (
    <div className="min-h-[220px] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 shadow-sm dark:bg-emerald-950/50 dark:text-emerald-50">
      {lines.map((line, idx) => (
        <span key={`line-${idx}`}>
          {line ? formatWhatsAppMarkup(line, `l${idx}`) : "\u00a0"}
          {idx < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </div>
  );
}

export default function OffersPage() {
  const customers = useCustomerStore((s) => s.customers);
  const fetchPaginatedCustomers = useCustomerStore((s) => s.fetchPaginatedCustomers);
  const isInitialLoaded = useCustomerStore((s) => s.isInitialLoaded);
  const offers = useOfferStore((s) => s.offers);
  const addOffer = useOfferStore((s) => s.addOffer);
  const updateOffer = useOfferStore((s) => s.updateOffer);
  const businessName = useSettingsStore((s) => s.businessName);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [validTill, setValidTill] = useState("");
  const [maxDiscountInput, setMaxDiscountInput] = useState("");
  const [details, setDetails] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageDirty, setMessageDirty] = useState(false);
  const [messageMode, setMessageMode] = useState<"edit" | "preview">("edit");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [loadOfferId, setLoadOfferId] = useState<string>("");

  useEffect(() => {
    if (!isInitialLoaded) {
      void fetchPaginatedCustomers({ page: 1, pageSize: 500 });
    }
  }, [isInitialLoaded, fetchPaginatedCustomers]);

  const maxDiscount = useMemo(() => {
    const n = Number.parseFloat(maxDiscountInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }, [maxDiscountInput]);

  const templateMessage = useMemo(
    () =>
      buildOfferBroadcastWhatsAppMessage(
        { name, code, validTill, maxDiscount, details },
        OFFER_CUSTOMER_NAME_PLACEHOLDER,
        { businessName }
      ),
    [name, code, validTill, maxDiscount, details, businessName]
  );

  useEffect(() => {
    if (!messageDirty) setMessageText(templateMessage);
  }, [templateMessage, messageDirty]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.has(c.id));

  const recentSent = useMemo(
    () =>
      [...offers]
        .filter((o) => o.status === "SENT")
        .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))
        .slice(0, 20),
    [offers]
  );

  const loadOffer = (id: string) => {
    setLoadOfferId(id);
    if (!id) {
      setMessageDirty(false);
      return;
    }
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    setName(offer.name);
    setCode(offer.code);
    setValidTill(offer.validTill.slice(0, 10));
    setMaxDiscountInput(offer.maxDiscount > 0 ? String(offer.maxDiscount) : "");
    setDetails(offer.details);
    setSelectedIds(new Set(offer.selectedCustomerIds));
    if (offer.customMessage?.trim()) {
      setMessageText(offer.customMessage);
      setMessageDirty(true);
    } else {
      setMessageDirty(false);
    }
  };

  const resetMessageToTemplate = () => {
    setMessageText(templateMessage);
    setMessageDirty(false);
  };

  const toggleCustomer = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of filteredCustomers) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  };

  const canSend =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    validTill.trim().length > 0 &&
    details.trim().length > 0 &&
    messageText.trim().length > 0 &&
    selectedCount > 0 &&
    !sending;

  const sendBroadcast = async () => {
    if (!canSend) {
      toast.error("Complete the offer and select at least one customer");
      return;
    }
    const recipients = customers.filter((c) => selectedIds.has(c.id) && c.phone?.trim());
    if (recipients.length === 0) {
      toast.error("Selected customers need a phone number");
      return;
    }

    const messageTemplate = messageText.trim();
    setSending(true);
    const now = new Date().toISOString();
    const offerId = newOfferId();
    const draft: OfferBroadcast = {
      id: offerId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      validTill,
      maxDiscount,
      details: details.trim(),
      customMessage: messageTemplate,
      selectedCustomerIds: recipients.map((c) => c.id),
      status: "DRAFT",
      sentCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await addOffer(draft);
    } catch (e) {
      setSending(false);
      toast.error(e instanceof Error ? e.message : "Could not save offer");
      return;
    }

    let sentOk = 0;
    let composerFallback = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const customer = recipients[i];
      const message = personalizeOfferWhatsAppMessage(messageTemplate, customer.name);
      try {
        await sendCustomerWhatsApp(customer.phone, message);
        sentOk += 1;
      } catch (e) {
        if (isWhatsAppNotConfiguredError(e)) {
          openWhatsAppComposer(customer.phone, message);
          composerFallback += 1;
        } else {
          failed += 1;
          console.warn("[offers-broadcast]", e instanceof ApiError ? e.message : e);
        }
      }
      if (i < recipients.length - 1) await sleep(SEND_DELAY_MS);
    }

    const totalTouched = sentOk + composerFallback;
    try {
      await updateOffer(offerId, {
        status: totalTouched > 0 ? "SENT" : "DRAFT",
        sentAt: totalTouched > 0 ? new Date().toISOString() : undefined,
        sentCount: totalTouched,
      });
    } catch {
      /* offer already saved as draft */
    }

    useNotificationStore.getState().addNotification({
      type: "whatsapp_sent",
      title: "Offer broadcast",
      message: `${draft.name}: ${totalTouched}/${recipients.length} customers`,
      href: "/offers",
    });

    if (totalTouched > 0) {
      toast.success("Broadcast complete", {
        description:
          composerFallback > 0
            ? `${sentOk} sent via API, ${composerFallback} opened in WhatsApp${failed ? `, ${failed} failed` : ""}.`
            : `${sentOk} message${sentOk === 1 ? "" : "s"} sent${failed ? `, ${failed} failed` : ""}.`,
      });
      setSelectedIds(new Set());
      setLoadOfferId("");
    } else {
      toast.error("No messages sent", {
        description: failed
          ? "Check WhatsApp configuration and try again."
          : "Could not reach any recipients.",
      });
    }
    setSending(false);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Offers & Promotions"
        description="Compose an offer, pick your audience, and broadcast on WhatsApp."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-sm"
            disabled={!canSend}
            onClick={() => void sendBroadcast()}
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send broadcast"}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Composer */}
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/70 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-4 py-3.5 sm:px-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Megaphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Offer composer</h2>
              <p className="text-xs text-muted-foreground">
                Fields draft a WhatsApp message you can edit before sending.
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {offers.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Load previous offer</Label>
                <Select
                  value={loadOfferId || "__none__"}
                  onValueChange={(v) => loadOffer(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Start fresh or reuse a past offer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Start fresh</SelectItem>
                    {offers.slice(0, 30).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="offer-name" className="text-xs">
                  Offer name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="offer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali detailing special"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-code" className="text-xs">
                  Coupon code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="offer-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DETAIL20"
                  className="h-9 font-mono tracking-wide"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-valid" className="text-xs">
                  Valid till <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="offer-valid"
                  type="date"
                  value={validTill}
                  onChange={(e) => setValidTill(e.target.value)}
                  className="h-9 date-input-icon-end pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="offer-discount" className="text-xs">
                  Max. discount amount (₹)
                </Label>
                <Input
                  id="offer-discount"
                  type="number"
                  min={0}
                  value={maxDiscountInput}
                  onChange={(e) => setMaxDiscountInput(e.target.value)}
                  placeholder="e.g. 500"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="offer-details" className="text-xs">
                  Offer details / benefit <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="offer-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g. ₹500 off on ceramic coating this week"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="offer-message"
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  WhatsApp message
                </Label>
                <div className="flex items-center gap-2">
                  {messageDirty && messageMode === "edit" ? (
                    <button
                      type="button"
                      onClick={resetMessageToTemplate}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Reset to template
                    </button>
                  ) : null}
                  <div
                    className="inline-flex rounded-lg border border-border/70 bg-background p-0.5"
                    role="group"
                    aria-label="Message view mode"
                  >
                    <button
                      type="button"
                      onClick={() => setMessageMode("edit")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                        messageMode === "edit"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageMode("preview")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                        messageMode === "preview"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>
              {messageMode === "edit" ? (
                <Textarea
                  id="offer-message"
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    setMessageDirty(true);
                  }}
                  rows={12}
                  spellCheck
                  className="min-h-[220px] resize-y rounded-2xl rounded-tl-md border-0 bg-[#dcf8c6] px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 dark:bg-emerald-950/50 dark:text-emerald-50"
                />
              ) : (
                <WhatsAppMessagePreview text={messageText} />
              )}
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {messageMode === "edit" ? (
                  <>
                    Edit freely for a custom message. Use{" "}
                    <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[10px]">
                      {OFFER_CUSTOMER_NAME_PLACEHOLDER}
                    </code>{" "}
                    to insert each customer&apos;s first name.
                  </>
                ) : (
                  <>
                    Preview shows sample name “{PREVIEW_SAMPLE_NAME}” and WhatsApp formatting
                    (*bold*, _italic_).
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Audience */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">Audience</h2>
                <p className="text-xs text-muted-foreground">Choose who receives this offer.</p>
              </div>
            </div>
            <Badge variant="secondary" className="tabular-nums shrink-0">
              {selectedCount} selected
            </Badge>
          </div>

          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 sm:px-5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email…"
                className="h-9 pl-8"
              />
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={(v) => toggleSelectAllFiltered(v === true)}
                disabled={filteredCustomers.length === 0}
              />
              Select all
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5">
            {filteredCustomers.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No customers found</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Add customers first, or clear the search filter.
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredCustomers.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                          checked ? "bg-primary/10" : "hover:bg-muted/70"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleCustomer(c.id, v === true)}
                        />
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            checked
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {getInitials(c.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.phone || "No phone"}
                            {c.email ? ` · ${c.email}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border/70 px-4 py-3 sm:px-5">
            <Button
              type="button"
              className="w-full gap-1.5"
              disabled={!canSend}
              onClick={() => void sendBroadcast()}
            >
              <Send className="h-3.5 w-3.5" />
              {sending
                ? "Sending…"
                : selectedCount > 0
                  ? `Send to ${selectedCount} customer${selectedCount === 1 ? "" : "s"}`
                  : "Select customers to send"}
            </Button>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Uses WhatsApp API when configured; otherwise opens the WhatsApp composer per
              recipient.
            </p>
          </div>
        </section>
      </div>

      {/* History */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold tracking-tight">Recent broadcasts</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{recentSent.length}</span>
        </div>
        {recentSent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
            Sent offers will show up here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Offer</th>
                  <th className="px-3 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Recipients</th>
                  <th className="px-3 py-2.5 font-medium">Sent</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSent.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-medium">{o.name}</p>
                      {o.maxDiscount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Max {formatCurrency(o.maxDiscount)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{o.code}</td>
                    <td className="px-3 py-3 tabular-nums">{o.sentCount}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {o.sentAt ? formatDate(o.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <Badge variant="success" className="text-[10px]">
                        Sent
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
