"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrganizationEntitlement } from "@/types";
import {
  branchLimitLabel,
  resolveContactUsUrl,
  resolveSupportPhone,
} from "@/lib/plan-limits";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";
import { useTenantPath } from "@/components/tenant/tenant-context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entitlement: OrganizationEntitlement | null;
};

export function BranchLimitReachedDialog({ open, onOpenChange, entitlement }: Props) {
  const tenantHref = useTenantPath();
  const max = entitlement?.subscription.effectiveMaxBranches ?? 1;
  const used = entitlement?.usage.branchesUsed ?? 0;
  const planName = entitlement?.subscription.planName ?? "your plan";
  const limitText = branchLimitLabel(max);
  const contactUrl = resolveContactUsUrl(entitlement);
  const supportPhone = resolveSupportPhone(entitlement);
  const status = entitlement?.subscription.status;
  const canSelfServeAddOn =
    status === "ACTIVE" &&
    (entitlement?.subscription.daysRemaining == null ||
      (entitlement.subscription.daysRemaining ?? 0) > 0) &&
    entitlement?.subscription.effectiveMaxBranches != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch limit reached</DialogTitle>
          <DialogDescription>
            {planName} includes {limitText} branch{max === 1 ? "" : "es"}. Payment keeps your
            subscription active — it does not remove this plan limit. Buy an extra branch or
            upgrade in Plan & billing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          <p>
            Current plan: <span className="font-medium text-foreground">{planName}</span>
          </p>
          <p>
            Branch limit: <span className="font-medium text-foreground">{limitText}</span>
          </p>
          <p>
            Current branches: <span className="font-medium text-foreground">{used}</span>
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button asChild className="w-full" onClick={() => onOpenChange(false)}>
            <Link href={`${tenantHref("/settings")}?tab=plan`}>
              {canSelfServeAddOn ? "Buy extra branch / upgrade" : "Open Plan & billing"}
            </Link>
          </Button>
          <PlanCtaButton
            href={contactUrl}
            phone={supportPhone}
            dialogTitle="Contact support"
            className="w-full"
            variant="outline"
          >
            Contact support
          </PlanCtaButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
