"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStaffStore } from "@/store/staff-store";

/** Sentinel SelectItem value — open QuickAddMechanicDialog instead of selecting. */
export const ADD_MECHANIC_SELECT_VALUE = "__add_mechanic__";

function suggestStaffEmail(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "mechanic"}.${Date.now().toString(36)}@mydetailos.local`;
}

export type QuickAddMechanicDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  /** Called after the mechanic is created and appears in the staff store. */
  onCreated: (mechanic: { id: string; name: string }) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

/**
 * Quick-create a MECHANIC staff account for a branch (same flow as pickup driver add).
 */
export function QuickAddMechanicDialog({
  open,
  onOpenChange,
  branchId,
  onCreated,
  title = "Add mechanic",
  description = "Creates a mechanic account for this branch.",
  confirmLabel = "Add mechanic",
}: QuickAddMechanicDialogProps) {
  const addStaff = useStaffStore((s) => s.addStaff);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const reset = () => {
    setAddName("");
    setAddPhone("");
    setAddEmail("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleQuickAdd = async () => {
    const name = addName.trim();
    const phone = addPhone.trim();
    if (!name || phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter name and a 10-digit mobile number.");
      return;
    }
    if (!branchId) {
      toast.error("Branch is required to add staff.");
      return;
    }
    const email = addEmail.trim() || suggestStaffEmail(name);
    setAdding(true);
    try {
      await addStaff({
        name,
        email,
        phone,
        role: "MECHANIC",
        branchId,
        isActive: true,
      });
      const created = useStaffStore.getState().staff.find(
        (s) => s.email.toLowerCase() === email.toLowerCase()
      );
      if (!created) {
        toast.error("Mechanic was created but could not be selected. Refresh and try again.");
        return;
      }
      toast.success(`${name} added as mechanic`);
      handleOpenChange(false);
      onCreated({ id: created.id, name: created.name });
    } catch {
      toast.error("Could not add staff. Check API server and try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="quick-add-mechanic-name">Full name</Label>
            <Input
              id="quick-add-mechanic-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-add-mechanic-phone">Mobile</Label>
            <Input
              id="quick-add-mechanic-phone"
              type="tel"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              placeholder="10-digit number"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-add-mechanic-email">Email (optional)</Label>
            <Input
              id="quick-add-mechanic-email"
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Auto-generated if left blank"
              autoComplete="email"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={adding} onClick={() => void handleQuickAdd()}>
            {adding ? "Adding…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
