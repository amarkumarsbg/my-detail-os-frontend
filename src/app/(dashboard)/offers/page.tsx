"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, Megaphone, Pencil, Save, Search, Send, Users } from "lucide-react";
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
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useSettingsStore } from "@/store/settings-store";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import {
  formatOfferApplicableLabel,
  formatOfferDiscountLabel,
} from "@/lib/offer-coupon";
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
import { normalizePhoneDigits } from "@/lib/phone";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type {
  OfferApplicableOn,
  OfferBroadcast,
  OfferDiscountType,
  OfferScope,
} from "@/types";

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
  const [validFrom, setValidFrom] = useState("");
  const [validTill, setValidTill] = useState("");
  const [discountType, setDiscountType] = useState<OfferDiscountType>("PERCENTAGE");
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [minBillInput, setMinBillInput] = useState("");
  const [maxDiscountInput, setMaxDiscountInput] = useState("");
  const [applicableOn, setApplicableOn] = useState<OfferApplicableOn>("FULL_BILL");
  const [scope, setScope] = useState<OfferScope>("ALL_ITEMS");
  const [applicableItemIds, setApplicableItemIds] = useState<Set<string>>(new Set());
  const [itemSearch, setItemSearch] = useState("");
  const [details, setDetails] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageDirty, setMessageDirty] = useState(false);
  const [messageMode, setMessageMode] = useState<"edit" | "preview">("edit");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [guestPhones, setGuestPhones] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadOfferId, setLoadOfferId] = useState<string>("");

  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);
  const inventoryParts = useInventoryStore((s) => s.parts);

  useEffect(() => {
    if (!isInitialLoaded) {
      void fetchPaginatedCustomers({ page: 1, pageSize: 500 });
    }
  }, [isInitialLoaded, fetchPaginatedCustomers]);

  const discountValue = useMemo(() => {
    const n = Number.parseFloat(discountValueInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }, [discountValueInput]);

  const minBillAmount = useMemo(() => {
    const n = Number.parseFloat(minBillInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }, [minBillInput]);

  const maxDiscount = useMemo(() => {
    const n = Number.parseFloat(maxDiscountInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }, [maxDiscountInput]);

  const scopeItemOptions = useMemo(() => {
    const services =
      applicableOn === "SPARE_PARTS"
        ? []
        : serviceCatalog
            .filter((s) => s.isActive !== false)
            .map((s) => ({ id: s.id, label: s.name, kind: "service" as const }));
    const parts =
      applicableOn === "SERVICES"
        ? []
        : inventoryParts.map((p) => ({
            id: p.id,
            label: p.name,
            kind: "part" as const,
          }));
    const q = itemSearch.trim().toLowerCase();
    const all = [...services, ...parts];
    if (!q) return all;
    return all.filter((x) => x.label.toLowerCase().includes(q));
  }, [applicableOn, serviceCatalog, inventoryParts, itemSearch]);

  const templateMessage = useMemo(
    () =>
      buildOfferBroadcastWhatsAppMessage(
        {
          name,
          code,
          validFrom,
          validTill,
          discountType,
          discountValue,
          minBillAmount,
          maxDiscount,
          applicableOn,
          details,
        },
        OFFER_CUSTOMER_NAME_PLACEHOLDER,
        { businessName }
      ),
    [
      name,
      code,
      validFrom,
      validTill,
      discountType,
      discountValue,
      minBillAmount,
      maxDiscount,
      applicableOn,
      details,
      businessName,
    ]
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

  const guestPhoneList = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of guestPhones.split(/[\s,;]+/)) {
      const digits = normalizePhoneDigits(raw);
      if (digits.length !== 10 || seen.has(digits)) continue;
      seen.add(digits);
      out.push(digits);
    }
    return out;
  }, [guestPhones]);

  const recentOffers = useMemo(
    () =>
      [...offers]
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
        .slice(0, 30),
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
    setValidFrom(offer.validFrom?.slice(0, 10) ?? "");
    setValidTill(offer.validTill.slice(0, 10));
    setDiscountType(offer.discountType === "FLAT" ? "FLAT" : "PERCENTAGE");
    setDiscountValueInput(
      typeof offer.discountValue === "number" && offer.discountValue > 0
        ? String(offer.discountValue)
        : ""
    );
    setMinBillInput(
      typeof offer.minBillAmount === "number" && offer.minBillAmount > 0
        ? String(offer.minBillAmount)
        : ""
    );
    setMaxDiscountInput(offer.maxDiscount > 0 ? String(offer.maxDiscount) : "");
    setApplicableOn(
      offer.applicableOn === "SERVICES" || offer.applicableOn === "SPARE_PARTS"
        ? offer.applicableOn
        : "FULL_BILL"
    );
    setScope(offer.scope === "SPECIFIC_ITEMS" ? "SPECIFIC_ITEMS" : "ALL_ITEMS");
    setApplicableItemIds(new Set(offer.applicableItemIds ?? []));
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

  const canSave =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    validTill.trim().length > 0 &&
    discountValue > 0 &&
    details.trim().length > 0 &&
    (scope !== "SPECIFIC_ITEMS" || applicableItemIds.size > 0) &&
    !saving &&
    !sending;

  const canSend =
    canSave && messageText.trim().length > 0 && (selectedCount > 0 || guestPhoneList.length > 0);

  const buildOfferRecord = (id: string, now: string, status: OfferBroadcast["status"]): OfferBroadcast => ({
    id,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    validFrom: validFrom.trim() || undefined,
    validTill,
    discountType,
    discountValue,
    minBillAmount: minBillAmount > 0 ? minBillAmount : undefined,
    maxDiscount,
    applicableOn,
    scope,
    applicableItemIds:
      scope === "SPECIFIC_ITEMS" ? Array.from(applicableItemIds) : undefined,
    details: details.trim(),
    customMessage: messageText.trim() || undefined,
    selectedCustomerIds: Array.from(selectedIds),
    status,
    sentCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const persistOffer = async (
    status: OfferBroadcast["status"],
    extra?: Partial<OfferBroadcast>
  ): Promise<OfferBroadcast> => {
    const now = new Date().toISOString();
    const existing = loadOfferId ? offers.find((o) => o.id === loadOfferId) : undefined;
    const id = existing?.id ?? newOfferId();
    const record: OfferBroadcast = {
      ...buildOfferRecord(id, existing?.createdAt ?? now, status),
      createdAt: existing?.createdAt ?? now,
      sentAt: extra?.sentAt ?? existing?.sentAt,
      sentCount: extra?.sentCount ?? existing?.sentCount ?? 0,
      status: extra?.status ?? status,
    };
    if (existing) {
      await updateOffer(id, record);
    } else {
      await addOffer(record);
      setLoadOfferId(id);
    }
    return record;
  };

  const saveCoupon = async () => {
    if (!canSave) {
      toast.error("Complete the coupon details before saving");
      return;
    }
    setSaving(true);
    try {
      const existing = loadOfferId ? offers.find((o) => o.id === loadOfferId) : undefined;
      const saved = await persistOffer(existing?.status === "SENT" ? "SENT" : "DRAFT");
      toast.success(
        selectedCount > 0
          ? `Coupon ${saved.code} saved for ${selectedCount} selected customer${selectedCount === 1 ? "" : "s"}`
          : `Coupon ${saved.code} saved — anyone can redeem this code at booking`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save coupon");
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    if (!canSend) {
      toast.error("Save the coupon details and add at least one registered customer or guest phone");
      return;
    }
    const registered = customers.filter((c) => selectedIds.has(c.id) && c.phone?.trim());
    const registeredDigits = new Set(
      registered.map((c) => normalizePhoneDigits(c.phone)).filter((d) => d.length === 10)
    );
    const guestRecipients = guestPhoneList.filter((p) => !registeredDigits.has(p));
    if (registered.length === 0 && guestRecipients.length === 0) {
      toast.error("Add a phone number to send this offer");
      return;
    }

    const messageTemplate = messageText.trim();
    setSending(true);
    let offerId = "";
    try {
      const saved = await persistOffer("DRAFT");
      offerId = saved.id;
    } catch (e) {
      setSending(false);
      toast.error(e instanceof Error ? e.message : "Could not save offer");
      return;
    }

    let sentOk = 0;
    let composerFallback = 0;
    let failed = 0;

    const sendOne = async (phone: string, displayName: string) => {
      const message = personalizeOfferWhatsAppMessage(messageTemplate, displayName);
      try {
        await sendCustomerWhatsApp(phone, message);
        sentOk += 1;
      } catch (e) {
        if (isWhatsAppNotConfiguredError(e)) {
          openWhatsAppComposer(phone, message);
          composerFallback += 1;
        } else {
          failed += 1;
          console.warn("[offers-broadcast]", e instanceof ApiError ? e.message : e);
        }
      }
    };

    for (let i = 0; i < registered.length; i++) {
      const customer = registered[i];
      await sendOne(customer.phone, customer.name);
      if (i < registered.length - 1 || guestRecipients.length > 0) await sleep(SEND_DELAY_MS);
    }
    for (let i = 0; i < guestRecipients.length; i++) {
      await sendOne(guestRecipients[i], "there");
      if (i < guestRecipients.length - 1) await sleep(SEND_DELAY_MS);
    }

    const totalTouched = sentOk + composerFallback;
    const totalRecipients = registered.length + guestRecipients.length;
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
      message: `${name.trim()}: ${totalTouched}/${totalRecipients} recipients`,
      href: "/offers",
    });

    if (totalTouched > 0) {
      toast.success("Broadcast complete", {
        description:
          composerFallback > 0
            ? `${sentOk} sent via API, ${composerFallback} opened in WhatsApp${failed ? `, ${failed} failed` : ""}.`
            : `${sentOk} message${sentOk === 1 ? "" : "s"} sent${failed ? `, ${failed} failed` : ""}.`,
      });
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shadow-sm"
              disabled={!canSave}
              onClick={() => void saveCoupon()}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save coupon"}
            </Button>
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
          </div>
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
                Fields save as a redeemable coupon. WhatsApp send is optional.
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
                <Label htmlFor="offer-min-bill" className="text-xs">
                  Min. bill amount (₹)
                </Label>
                <Input
                  id="offer-min-bill"
                  type="number"
                  min={0}
                  value={minBillInput}
                  onChange={(e) => setMinBillInput(e.target.value)}
                  placeholder="e.g. 1000 (optional)"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-valid-from" className="text-xs">
                  Start date
                </Label>
                <Input
                  id="offer-valid-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="h-9 date-input-icon-end pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-valid" className="text-xs">
                  Expiry date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="offer-valid"
                  type="date"
                  value={validTill}
                  onChange={(e) => setValidTill(e.target.value)}
                  className="h-9 date-input-icon-end pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Discount type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={discountType}
                  onValueChange={(v) =>
                    setDiscountType(v === "FLAT" ? "FLAT" : "PERCENTAGE")
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FLAT">Flat amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-discount-value" className="text-xs">
                  Value <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="offer-discount-value"
                  type="number"
                  min={0}
                  value={discountValueInput}
                  onChange={(e) => setDiscountValueInput(e.target.value)}
                  placeholder={discountType === "FLAT" ? "e.g. 500" : "e.g. 10"}
                  className="h-9"
                />
              </div>
              {discountType === "PERCENTAGE" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="offer-discount" className="text-xs">
                    Max. discount limit (₹)
                  </Label>
                  <Input
                    id="offer-discount"
                    type="number"
                    min={0}
                    value={maxDiscountInput}
                    onChange={(e) => setMaxDiscountInput(e.target.value)}
                    placeholder="e.g. 500 (optional)"
                    className="h-9"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Applicable on</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["FULL_BILL", "Full bill"],
                      ["SERVICES", "Services"],
                      ["SPARE_PARTS", "Spare parts"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setApplicableOn(value);
                        setApplicableItemIds(new Set());
                      }}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                        applicableOn === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Scope</Label>
                <Select
                  value={scope}
                  onValueChange={(v) =>
                    setScope(v === "SPECIFIC_ITEMS" ? "SPECIFIC_ITEMS" : "ALL_ITEMS")
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ITEMS">Apply to all items</SelectItem>
                    <SelectItem value="SPECIFIC_ITEMS">Apply to specific items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === "SPECIFIC_ITEMS" ? (
                <div className="space-y-2 sm:col-span-2 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search services / parts…"
                      className="h-9 pl-8"
                    />
                  </div>
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {scopeItemOptions.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                        No items available for this scope.
                      </p>
                    ) : (
                      scopeItemOptions.map((item) => {
                        const checked = applicableItemIds.has(item.id);
                        return (
                          <label
                            key={`${item.kind}-${item.id}`}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                              checked ? "bg-primary/10" : "hover:bg-muted/70"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setApplicableItemIds((prev) => {
                                  const next = new Set(prev);
                                  if (v === true) next.add(item.id);
                                  else next.delete(item.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {item.label}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {item.kind}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {applicableItemIds.size} item
                    {applicableItemIds.size === 1 ? "" : "s"} selected
                  </p>
                </div>
              ) : null}
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
                <p className="text-xs text-muted-foreground">
                  Optional. Leave empty so anyone can redeem the code.
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="tabular-nums shrink-0">
              {selectedCount} selected
            </Badge>
          </div>

          <div className="space-y-2 border-b border-border/60 px-4 py-2.5 sm:px-5">
            <Label htmlFor="offer-guest-phones" className="text-xs">
              Send to unregistered numbers
            </Label>
            <Input
              id="offer-guest-phones"
              value={guestPhones}
              onChange={(e) => setGuestPhones(e.target.value)}
              placeholder="e.g. 9876543210, 9123456789"
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              {guestPhoneList.length > 0
                ? `${guestPhoneList.length} guest number${guestPhoneList.length === 1 ? "" : "s"} ready to send. They do not need to be in Customers.`
                : "Paste 10-digit numbers separated by comma or space. The coupon still works at booking for walk-ins if no customers are selected."}
            </p>
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
                  No registered customers match. Save the coupon anyway, or send to guest
                  numbers above.
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

          <div className="space-y-2 border-t border-border/70 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              disabled={!canSave}
              onClick={() => void saveCoupon()}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save coupon"}
            </Button>
            <Button
              type="button"
              className="w-full gap-1.5"
              disabled={!canSend}
              onClick={() => void sendBroadcast()}
            >
              <Send className="h-3.5 w-3.5" />
              {sending
                ? "Sending…"
                : selectedCount + guestPhoneList.length > 0
                  ? `Send to ${selectedCount + guestPhoneList.length} recipient${selectedCount + guestPhoneList.length === 1 ? "" : "s"}`
                  : "Add customers or guest numbers to send"}
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Save stores the coupon so it can be redeemed on booking. Send is optional and
              works for registered customers or numbers that are not in the workshop yet.
            </p>
          </div>
        </section>
      </div>

      {/* History */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold tracking-tight">Saved coupons</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{recentOffers.length}</span>
        </div>
        {recentOffers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
            Saved and sent coupons will show up here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Offer</th>
                  <th className="px-3 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Discount</th>
                  <th className="px-3 py-2.5 font-medium">Recipients</th>
                  <th className="px-3 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOffers.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatOfferApplicableLabel(o)}
                        {o.minBillAmount && o.minBillAmount > 0
                          ? ` · Min ${formatCurrency(o.minBillAmount)}`
                          : ""}
                        {(o.selectedCustomerIds?.length ?? 0) === 0 ? " · All customers" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{o.code}</td>
                    <td className="px-3 py-3 text-xs font-medium text-primary">
                      {formatOfferDiscountLabel(o)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{o.sentCount}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatDate(o.updatedAt || o.sentAt || o.createdAt)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <Badge variant={o.status === "SENT" ? "success" : "secondary"} className="text-[10px]">
                        {o.status === "SENT" ? "Sent" : "Saved"}
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
