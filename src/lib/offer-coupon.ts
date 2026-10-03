import type {
  OfferApplicableOn,
  OfferBroadcast,
  OfferDiscountType,
  OfferScope,
} from "@/types";

export type OfferCouponContext = {
  now?: Date;
  customerId?: string | null;
  servicesSubtotal: number;
  partsSubtotal: number;
  selectedServiceIds: string[];
  selectedPartIds: string[];
  /** Per-line excl. GST amounts when evaluating specific-item scope. */
  serviceAmountsById?: Record<string, number>;
  partAmountsById?: Record<string, number>;
};

export type OfferCouponResult =
  | { ok: true; amount: number; offer: OfferBroadcast }
  | { ok: false; error: string };

function parseDayStart(isoDate: string): Date | null {
  const raw = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEnd(isoDate: string): Date | null {
  const raw = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeOfferCode(code: string): string {
  return code.trim().toUpperCase();
}

export function findOfferByCode(
  offers: OfferBroadcast[],
  code: string
): OfferBroadcast | undefined {
  const needle = normalizeOfferCode(code);
  if (!needle) return undefined;
  return offers.find((o) => normalizeOfferCode(o.code) === needle);
}

function resolveDiscountType(offer: OfferBroadcast): OfferDiscountType {
  return offer.discountType === "FLAT" ? "FLAT" : "PERCENTAGE";
}

function resolveApplicableOn(offer: OfferBroadcast): OfferApplicableOn {
  if (offer.applicableOn === "SERVICES" || offer.applicableOn === "SPARE_PARTS") {
    return offer.applicableOn;
  }
  return "FULL_BILL";
}

function resolveScope(offer: OfferBroadcast): OfferScope {
  return offer.scope === "SPECIFIC_ITEMS" ? "SPECIFIC_ITEMS" : "ALL_ITEMS";
}

function sumSelected(
  ids: string[],
  amounts: Record<string, number> | undefined,
  fallbackTotal: number,
  restrictTo: Set<string> | null
): number {
  if (!restrictTo) return fallbackTotal;
  if (!amounts) {
    return ids.some((id) => restrictTo.has(id)) ? fallbackTotal : 0;
  }
  let sum = 0;
  for (const id of ids) {
    if (!restrictTo.has(id)) continue;
    const n = amounts[id] ?? 0;
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

export function eligibleOfferBases(
  offer: OfferBroadcast,
  ctx: OfferCouponContext
): { services: number; parts: number; total: number } {
  const applicableOn = resolveApplicableOn(offer);
  const scope = resolveScope(offer);
  const restrict =
    scope === "SPECIFIC_ITEMS" && (offer.applicableItemIds?.length ?? 0) > 0
      ? new Set(offer.applicableItemIds)
      : null;

  const servicesRaw = sumSelected(
    ctx.selectedServiceIds,
    ctx.serviceAmountsById,
    ctx.servicesSubtotal,
    applicableOn === "SPARE_PARTS" ? new Set() : restrict
  );
  const partsRaw = sumSelected(
    ctx.selectedPartIds,
    ctx.partAmountsById,
    ctx.partsSubtotal,
    applicableOn === "SERVICES" ? new Set() : restrict
  );

  const services = applicableOn === "SPARE_PARTS" ? 0 : servicesRaw;
  const parts = applicableOn === "SERVICES" ? 0 : partsRaw;
  const total = Math.round((services + parts) * 100) / 100;
  return { services, parts, total };
}

export function eligibleOfferBase(
  offer: OfferBroadcast,
  ctx: OfferCouponContext
): number {
  return eligibleOfferBases(offer, ctx).total;
}

/** Split a coupon discount across services vs parts by eligible base share. */
export function splitOfferCouponDiscount(
  offer: OfferBroadcast,
  ctx: OfferCouponContext,
  amount: number
): { services: number; parts: number } {
  const bases = eligibleOfferBases(offer, ctx);
  if (!(bases.total > 0) || !(amount > 0)) return { services: 0, parts: 0 };
  const services =
    Math.round(amount * (bases.services / bases.total) * 100) / 100;
  const parts = Math.round((amount - services) * 100) / 100;
  return { services, parts };
}

export function computeOfferCouponDiscount(
  offer: OfferBroadcast,
  ctx: OfferCouponContext
): OfferCouponResult {
  const now = ctx.now ?? new Date();

  if (offer.validFrom?.trim()) {
    const start = parseDayStart(offer.validFrom);
    if (start && now < start) {
      return { ok: false, error: "This coupon is not active yet" };
    }
  }

  if (offer.validTill?.trim()) {
    const end = parseDayEnd(offer.validTill);
    if (end && now > end) {
      return { ok: false, error: "This coupon has expired" };
    }
  }

  if (
    offer.selectedCustomerIds.length > 0 &&
    ctx.customerId &&
    !offer.selectedCustomerIds.includes(ctx.customerId)
  ) {
    return { ok: false, error: "This coupon is not valid for this customer" };
  }

  const base = eligibleOfferBase(offer, ctx);
  const minBill = offer.minBillAmount ?? 0;
  if (minBill > 0 && base < minBill) {
    return {
      ok: false,
      error: `Minimum bill of ₹${minBill.toLocaleString("en-IN")} required`,
    };
  }

  if (!(base > 0)) {
    return { ok: false, error: "No eligible items for this coupon" };
  }

  const discountType = resolveDiscountType(offer);
  const rawValue = offer.discountValue;
  const discountValue =
    typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0
      ? rawValue
      : 0;

  if (discountValue <= 0) {
    return { ok: false, error: "This coupon has no discount configured" };
  }

  let amount = 0;
  if (discountType === "FLAT") {
    amount = Math.min(discountValue, base);
  } else {
    amount = Math.round(base * (discountValue / 100) * 100) / 100;
    const cap = offer.maxDiscount ?? 0;
    if (cap > 0) amount = Math.min(amount, cap);
    amount = Math.min(amount, base);
  }

  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) {
    return { ok: false, error: "Coupon discount is zero for this bill" };
  }

  return { ok: true, amount, offer };
}

export function formatOfferDiscountLabel(offer: OfferBroadcast): string {
  const type = resolveDiscountType(offer);
  const value = offer.discountValue ?? 0;
  if (!(value > 0)) {
    return offer.maxDiscount > 0 ? `Max ₹${offer.maxDiscount}` : "—";
  }
  if (type === "FLAT") return `₹${value}`;
  const cap =
    offer.maxDiscount > 0 ? ` (max ₹${offer.maxDiscount})` : "";
  return `${value}%${cap}`;
}

export function formatOfferApplicableLabel(offer: OfferBroadcast): string {
  const on = resolveApplicableOn(offer);
  if (on === "SERVICES") return "Services";
  if (on === "SPARE_PARTS") return "Spare parts";
  return "Full bill";
}
