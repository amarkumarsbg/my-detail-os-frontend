"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADD_MECHANIC_SELECT_VALUE,
  QuickAddMechanicDialog,
} from "@/components/staff/quick-add-mechanic-dialog";
import { useAuthStore } from "@/store/auth-store";
import { useStaffStore } from "@/store/staff-store";
import { canCreateStaffAccounts } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/** @deprecated Use ADD_MECHANIC_SELECT_VALUE — kept for existing pickup imports. */
export const ADD_DRIVER_SELECT_VALUE = ADD_MECHANIC_SELECT_VALUE;

type PickupDriverSelectProps = {
  branchId: string;
  value: string;
  onValueChange: (driverId: string, driverName?: string) => void;
  triggerClassName?: string;
  placeholder?: string;
  /** When set, only list drivers for this branch. When empty, lists all active mechanics. */
  branchScoped?: boolean;
  size?: "default" | "compact";
  disabled?: boolean;
};

export function PickupDriverSelect({
  branchId,
  value,
  onValueChange,
  triggerClassName,
  placeholder = "Assign driver",
  branchScoped = true,
  size = "default",
  disabled = false,
}: PickupDriverSelectProps) {
  const staff = useStaffStore((s) => s.staff);
  const authRole = useAuthStore((s) => s.user?.role);
  const canAdd = canCreateStaffAccounts(authRole);

  const [addOpen, setAddOpen] = useState(false);

  const drivers = useMemo(
    () =>
      staff.filter(
        (u) =>
          u.isActive &&
          u.role === "MECHANIC" &&
          (!branchScoped || !branchId || u.branchId === branchId)
      ),
    [staff, branchId, branchScoped]
  );

  const handleSelect = (next: string) => {
    if (next === ADD_MECHANIC_SELECT_VALUE) {
      setAddOpen(true);
      return;
    }
    if (next === "unassigned") {
      onValueChange("unassigned");
      return;
    }
    const driver = drivers.find((d) => d.id === next);
    onValueChange(next, driver?.name);
  };

  return (
    <>
      <Select value={value || "unassigned"} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger
          className={cn(
            "bg-background",
            size === "compact"
              ? "h-8 w-[168px] max-w-full text-xs px-2.5 [&>svg]:size-3.5"
              : "h-9 max-w-xs",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {drivers.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
          {canAdd && (
            <>
              <SelectSeparator />
              <SelectItem value={ADD_MECHANIC_SELECT_VALUE} className="text-primary font-medium">
                + Add driver or mechanic
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <QuickAddMechanicDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        branchId={branchId}
        title="Add driver or mechanic"
        description="Creates a mechanic account for this branch and selects them as pickup driver."
        confirmLabel="Add & assign"
        onCreated={(m) => onValueChange(m.id, m.name)}
      />
    </>
  );
}
