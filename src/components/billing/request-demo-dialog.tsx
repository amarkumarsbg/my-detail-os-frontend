"use client";

import { useEffect, useMemo, useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { useDemoRequestStore } from "@/store/demo-request-store";
import { useNotificationStore } from "@/store/notification-store";
import { cn } from "@/lib/utils";
import type { DemoRequest } from "@/types";

const SLOT_OPTIONS = [
  "10:00 AM - 11:00 AM",
  "11:30 AM - 12:30 PM",
  "02:00 PM - 03:00 PM",
  "03:30 PM - 04:30 PM",
  "05:00 PM - 06:00 PM",
] as const;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `demo-${crypto.randomUUID()}`;
  }
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic “booked” slots for a date so the UI feels live without a booking API. */
function isSlotBooked(dateKey: string, slot: string): boolean {
  let h = 0;
  const s = `${dateKey}|${slot}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 5 === 0;
}

type Step = 1 | 2 | 3;

export function RequestDemoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);
  const businessPhone = useSettingsStore((s) => s.businessPhone);
  const businessWhatsApp = useSettingsStore((s) => s.businessWhatsApp);
  const addDemoRequest = useDemoRequestStore((s) => s.addDemoRequest);

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [city, setCity] = useState("");
  const [interests, setInterests] = useState("");
  const [selectedDate, setSelectedDate] = useState(() =>
    format(addDays(new Date(), 1), "yyyy-MM-dd")
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState<DemoRequest | null>(null);

  const dateCards = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: 10 }, (_, i) => {
      const d = addDays(start, i + 1);
      return {
        key: format(d, "yyyy-MM-dd"),
        dow: format(d, "EEE").toUpperCase(),
        day: format(d, "d"),
        mon: format(d, "MMM"),
      };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSubmitting(false);
    setBooked(null);
    setSelectedSlot(null);
    setFullName(user?.name?.trim() || "");
    setMobile(
      (businessWhatsApp || businessPhone || user?.phone || "").replace(/\s+/g, "")
    );
    setWorkshopName(businessName?.trim() || "");
    setCity("");
    setInterests("");
    setSelectedDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  }, [open, user?.name, user?.phone, businessName, businessPhone, businessWhatsApp]);

  const canContinueStep1 =
    fullName.trim().length > 1 &&
    mobile.trim().length >= 8 &&
    workshopName.trim().length > 1;

  const confirmBooking = async () => {
    if (!selectedSlot) {
      toast.error("Pick an available time slot");
      return;
    }
    setSubmitting(true);
    const item: DemoRequest = {
      id: newId(),
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      workshopName: workshopName.trim(),
      city: city.trim(),
      interests: interests.trim(),
      slotDate: selectedDate,
      slotLabel: selectedSlot,
      status: "SCHEDULED",
      createdByUserId: user?.id,
      organizationId: user?.organizationId,
      organizationName: businessName?.trim() || workshopName.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await addDemoRequest(item);
      setBooked(item);
      setStep(3);
      useNotificationStore.getState().addNotification({
        type: "system",
        title: "Demo scheduled",
        message: `${item.slotDate} · ${item.slotLabel}`,
        href: "/support",
      });
      toast.success("Demo scheduled successfully!", {
        description: `Your demo is booked for ${item.slotDate} at ${item.slotLabel}.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book demo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(dialogMobileSheetContentClasses, "sm:max-w-xl")}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <div className="flex items-start gap-3 pr-6">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-base sm:text-lg">
                Request a live product demo
              </DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Get a personalized walkthrough of MY DETAIL OS
              </p>
            </div>
          </div>

          {step !== 3 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  step === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                1. Workshop details
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  step === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                2. Choose slot
              </span>
            </div>
          ) : null}
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3.5 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="demo-name" className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                Your full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="demo-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-mobile" className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" />
                Mobile number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="demo-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="h-9"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-workshop" className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Garage / workshop name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="demo-workshop"
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-city" className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                City
              </Label>
              <Input
                id="demo-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Delhi, Mumbai"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-interests">What would you like to see? (optional)</Label>
              <Textarea
                id="demo-interests"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. Job cards, WhatsApp updates, inventory, multi-branch…"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Select date
                </Label>
                <Input
                  type="date"
                  className="h-8 w-auto"
                  min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {dateCards.map((d) => {
                  const active = d.key === selectedDate;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d.key);
                        setSelectedSlot(null);
                      }}
                      className={cn(
                        "min-w-[68px] shrink-0 rounded-xl border px-2.5 py-2 text-center transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card hover:bg-muted/60"
                      )}
                    >
                      <p className="text-[10px] font-semibold opacity-80">{d.dow}</p>
                      <p className="text-sm font-bold tabular-nums leading-tight">
                        {d.day} {d.mon}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                Available time slots
              </Label>
              <div className="space-y-2">
                {SLOT_OPTIONS.map((slot) => {
                  const bookedSlot = isSlotBooked(selectedDate, slot);
                  const active = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={bookedSlot}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "relative flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                        bookedSlot && "cursor-not-allowed opacity-55",
                        active
                          ? "border-primary bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
                          : "border-border bg-card hover:bg-muted/50"
                      )}
                    >
                      <div>
                        <p className="font-medium">{slot}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              bookedSlot ? "bg-rose-500" : "bg-emerald-500"
                            )}
                          />
                          <span
                            className={
                              bookedSlot ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                            }
                          >
                            {bookedSlot ? "Booked" : "Available"}
                          </span>
                        </p>
                      </div>
                      {active ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 && booked ? (
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Demo booked successfully!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Our team will walk you through MY DETAIL OS on your scheduled slot.
              </p>
            </div>
            <div className="w-full rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-left text-sm">
              <div className="flex justify-between gap-3 py-1">
                <span className="text-muted-foreground">Workshop</span>
                <span className="font-medium">{booked.workshopName}</span>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <span className="text-muted-foreground">Date & time</span>
                <span className="font-medium text-primary">
                  {booked.slotDate} · {booked.slotLabel}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <span className="text-muted-foreground">Contact</span>
                <span className="font-medium">{booked.mobile}</span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canContinueStep1}
                onClick={() => setStep(2)}
                className="gap-1"
              >
                Select date & time
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                type="button"
                disabled={!selectedSlot || submitting}
                onClick={() => void confirmBooking()}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {submitting ? "Booking…" : "Confirm & book demo"}
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <Button type="button" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
