"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranchStore } from "@/store/branch-store";
import { useOrganizationStore } from "@/store/organization-store";
import { useStaffStore } from "@/store/staff-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useExpenseStore } from "@/store/expense-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { usePayrollStore } from "@/store/payroll-store";
import { useAttendanceStore } from "@/store/attendance-store";
import { useAuthStore } from "@/store/auth-store";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { canManageOrgBranches } from "@/lib/rbac";
import {
  canDeleteBranch,
  getBranchDeletionBlockers,
  type BranchDeletionBlocker,
} from "@/lib/branch-deletion";
import type { Branch } from "@/types";
import {
  BranchFormDialog,
  type BranchFormValues,
} from "@/components/branches/branch-form-dialog";
import { BranchLimitReachedDialog } from "@/components/branches/branch-limit-reached-dialog";
import { ApiError } from "@/lib/api-client";
import {
  branchLimitLabel,
  isAtOrOverBranchLimit,
  resolveContactUsUrl,
  resolveSupportPhone,
} from "@/lib/plan-limits";
import { PlanCtaTextButton } from "@/components/billing/plan-cta-link";
import {
  Building2,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function BranchesPage() {
  const tenantHref = useTenantPath();
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = canManageOrgBranches(userRole);
  const branches = useBranchStore((s) => s.branches);
  const addBranch = useBranchStore((s) => s.addBranch);
  const updateBranch = useBranchStore((s) => s.updateBranch);
  const deactivateBranch = useBranchStore((s) => s.deactivateBranch);
  const deleteBranch = useBranchStore((s) => s.deleteBranch);
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const refreshEntitlement = useOrganizationStore((s) => s.refreshEntitlement);
  const atLimit = isAtOrOverBranchLimit(entitlement);
  const staff = useStaffStore((s) => s.staff);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const expenses = useExpenseStore((s) => s.expenses);
  const pickupDropRequests = usePickupDropStore((s) => s.requests);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const salaryAdvances = usePayrollStore((s) => s.salaryAdvances);
  const salaryAdvanceRecoveries = usePayrollStore((s) => s.salaryAdvanceRecoveries);
  const attendanceRecords = useAttendanceStore((s) => s.records);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewing, setViewing] = useState<Branch | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const openAddLocation = () => {
    if (atLimit) {
      setLimitDialogOpen(true);
      return;
    }
    setEditing(null);
    setFormMode("add");
    setFormOpen(true);
  };

  const deletionContext = useMemo(
    () => ({
      staff,
      jobCards,
      expenses,
      pickupDropRequests,
      payrollRecords,
      salaryAdvances,
      salaryAdvanceRecoveries,
      attendanceRecords,
      totalBranches: branches.length,
    }),
    [
      staff,
      jobCards,
      expenses,
      pickupDropRequests,
      payrollRecords,
      salaryAdvances,
      salaryAdvanceRecoveries,
      attendanceRecords,
      branches.length,
    ]
  );

  const deleteBlockersForTarget = useMemo((): BranchDeletionBlocker[] => {
    if (!deleteTarget) return [];
    return getBranchDeletionBlockers(deleteTarget.id, deletionContext);
  }, [deleteTarget, deletionContext]);

  const staffCountByBranch = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of staff) {
      m.set(u.branchId, (m.get(u.branchId) ?? 0) + 1);
    }
    return m;
  }, [staff]);

  const requestSetActive = (b: Branch, nextActive: boolean) => {
    if (!canEdit) return;
    if (!nextActive) {
      setDeactivateTarget(b);
      return;
    }
    void (async () => {
      try {
        await updateBranch(b.id, { isActive: true });
        toast.success("Site activated");
      } catch {
        toast.error("Could not activate. Is the API running?");
      }
    })();
  };

  const applyForm = async (values: BranchFormValues, id?: string) => {
    const payload = {
      name: values.name,
      code: values.code,
      address: values.address,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      phone: values.phone,
      email: values.email || undefined,
      managerName: values.managerName || undefined,
      managerPhone: values.managerPhone || undefined,
      isActive: values.isActive,
    };
    try {
      if (id) {
        await updateBranch(id, payload);
        toast.success("Location updated");
      } else {
        if (atLimit) {
          setLimitDialogOpen(true);
          return;
        }
        await addBranch(payload);
        toast.success("Location created");
        await refreshEntitlement();
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "BRANCH_LIMIT_REACHED") {
        await refreshEntitlement();
        setLimitDialogOpen(true);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not save location. Is the API running?");
    }
  };

  const columns = [
    {
      key: "name",
      label: "Site",
      sortable: true,
      render: (b: Branch) => (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/35">
            <Building2 className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{b.name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {b.code ?? b.id}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      render: (b: Branch) => (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">{b.city || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {[b.state, b.pincode].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Contact",
      sortable: true,
      render: (b: Branch) => (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{b.phone}</span>
          </div>
          {b.email && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{b.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      label: "Team",
      render: (b: Branch) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{staffCountByBranch.get(b.id) ?? 0}</span>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (b: Branch) =>
        canEdit ? (
          <div className="flex items-center gap-2">
            <Switch
              id={`branch-active-${b.id}`}
              checked={b.isActive}
              onCheckedChange={(checked) => requestSetActive(b, checked)}
              aria-label={b.isActive ? "Active — tap to deactivate" : "Inactive — tap to activate"}
            />
            <Label
              htmlFor={`branch-active-${b.id}`}
              className={cn(
                "text-xs font-medium cursor-pointer",
                b.isActive ? "text-teal-700 dark:text-teal-300" : "text-muted-foreground"
              )}
            >
              {b.isActive ? "Active" : "Inactive"}
            </Label>
          </div>
        ) : (
          <Badge
            className={cn(
              "font-normal",
              b.isActive
                ? "bg-teal-100 text-teal-900 hover:bg-teal-100 dark:bg-teal-900/40 dark:text-teal-100"
                : "text-muted-foreground"
            )}
            variant={b.isActive ? "secondary" : "outline"}
          >
            {b.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right w-[140px]",
      render: (b: Branch) => {
        const deletable = canDeleteBranch(b.id, deletionContext);
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="View"
              onClick={() => setViewing(b)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Edit"
                  onClick={() => {
                    setEditing(b);
                    setFormMode("edit");
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    deletable
                      ? "text-destructive hover:text-destructive"
                      : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                  aria-label="Delete permanently"
                  title={
                    deletable
                      ? "Delete permanently"
                      : "Cannot delete — site has employees or work history"
                  }
                  onClick={() => setDeleteTarget(b)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch"
        description="Manage workshop branches, contacts, and operating status"
        actions={
          canEdit ? (
            <Button type="button" size="sm" onClick={openAddLocation}>
              <Plus className="h-4 w-4" />
              Add branch
            </Button>
          ) : undefined
        }
      />

      {canEdit && atLimit && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">
            {entitlement &&
            entitlement.usage.branchesUsed >
              (entitlement.subscription.effectiveMaxBranches ?? Infinity)
              ? "Over plan limit—contact us or remove locations."
              : "Branch limit reached on your current plan."}
          </p>
          <p className="mt-1 text-muted-foreground">
            {entitlement?.subscription.planName ?? "Plan"} ·{" "}
            {entitlement?.usage.branchesUsed ?? branches.length} /{" "}
            {branchLimitLabel(entitlement?.subscription.effectiveMaxBranches)} branches.{" "}
            <Link
              href={`${tenantHref("/settings")}?tab=plan`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Buy extra branch / upgrade
            </Link>
            {" · "}
            <PlanCtaTextButton
              href={resolveContactUsUrl(entitlement)}
              phone={resolveSupportPhone(entitlement)}
              dialogTitle="Contact support"
            >
              Contact support
            </PlanCtaTextButton>
            .
          </p>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          View-only. To add or change sites, sign in as an org admin — quick edits also live under{" "}
          <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
            Settings → Branches
          </Link>
          .
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="h-7 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">Branch directory</h2>
      </div>

      <Card className="border-border/80 p-0 shadow-sm overflow-hidden">
        <DataTable
          data={branches}
          columns={columns}
          hideSearch
          renderMobileCard={(item) => {
            const b = item as Branch;
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{b.name}</p>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Label
                        htmlFor={`branch-active-mobile-${b.id}`}
                        className={cn(
                          "text-xs font-medium",
                          b.isActive ? "text-teal-700 dark:text-teal-300" : "text-muted-foreground"
                        )}
                      >
                        {b.isActive ? "Active" : "Inactive"}
                      </Label>
                      <Switch
                        id={`branch-active-mobile-${b.id}`}
                        checked={b.isActive}
                        onCheckedChange={(checked) => requestSetActive(b, checked)}
                        aria-label={
                          b.isActive ? "Active — tap to deactivate" : "Inactive — tap to activate"
                        }
                      />
                    </div>
                  ) : (
                    <Badge
                      className={cn(
                        "shrink-0 font-normal",
                        b.isActive
                          ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100"
                          : "text-muted-foreground"
                      )}
                      variant={b.isActive ? "secondary" : "outline"}
                    >
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{b.code ?? b.id}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span>{b.phone}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {staffCountByBranch.get(b.id) ?? 0} staff
                  </span>
                </div>
                {canEdit ? (
                  <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1"
                      onClick={() => {
                        setEditing(b);
                        setFormMode("edit");
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setViewing(b)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                  </div>
                ) : null}
              </>
            );
          }}
        />
      </Card>

      <BranchFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        branch={editing}
        onSubmit={async (values) => {
          if (formMode === "edit" && editing) await applyForm(values, editing.id);
          else await applyForm(values);
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Site details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm pt-2">
              <p className="font-semibold text-base">{viewing.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{viewing.code ?? viewing.id}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{viewing.address}</p>
              <p>
                {viewing.city}, {viewing.state} {viewing.pincode}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                {viewing.phone}
              </p>
              {viewing.email && <p>{viewing.email}</p>}
              {(viewing.managerName || viewing.managerPhone) && (
                <div className="border-t pt-3 mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Site lead
                  </p>
                  {viewing.managerName && <p>{viewing.managerName}</p>}
                  {viewing.managerPhone && <p className="text-muted-foreground">{viewing.managerPhone}</p>}
                </div>
              )}
              <Badge
                variant="secondary"
                className={
                  viewing.isActive
                    ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100"
                    : ""
                }
              >
                {viewing.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate site?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deactivateTarget?.name} will be marked inactive and hidden from branch pickers. Staff
            assignments are unchanged. You can turn the Active switch back on anytime, or delete the
            site permanently once it has no employees or work history.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (deactivateTarget) {
                  try {
                    await deactivateBranch(deactivateTarget.id);
                    toast.success("Site deactivated");
                  } catch {
                    toast.error("Could not deactivate. Is the API running?");
                  }
                }
                setDeactivateTarget(null);
              }}
            >
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteBlockersForTarget.length === 0 ? "Delete site permanently?" : "Cannot delete site"}
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3 text-sm">
              {deleteBlockersForTarget.length === 0 ? (
                <>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{deleteTarget.name}</span> will be
                    removed permanently. This cannot be undone.
                  </p>
                  {deleteTarget.isActive && (
                    <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                      This site is still active. Deleting it is only allowed because it has no
                      employees or work history.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{deleteTarget.name}</span> cannot be
                    deleted until the following are cleared or reassigned:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {deleteBlockersForTarget.map((blocker) => (
                      <li key={blocker.kind}>{blocker.message}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {deleteBlockersForTarget.length === 0 ? "Cancel" : "Close"}
            </Button>
            {deleteBlockersForTarget.length === 0 && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    await deleteBranch(deleteTarget.id);
                    toast.success("Site deleted permanently");
                    setDeleteTarget(null);
                    await refreshEntitlement();
                  } catch (e) {
                    const msg =
                      e instanceof Error ? e.message : "Could not delete. Is the API running?";
                    toast.error(msg);
                  }
                }}
              >
                Delete permanently
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BranchLimitReachedDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        entitlement={entitlement}
      />
    </div>
  );
}
