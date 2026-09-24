"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Branch } from "@/types";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

function sanitizeTenDigitPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}


type Mode = "add" | "edit";

export interface BranchFormValues {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  managerName: string;
  managerPhone: string;
  isActive: boolean;
}

function emptyForm(): BranchFormValues {
  return {
    name: "",
    code: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    managerName: "",
    managerPhone: "",
    isActive: true,
  };
}

function branchToForm(b: Branch): BranchFormValues {
  return {
    name: b.name,
    code: b.code ?? "",
    address: b.address,
    city: b.city ?? "",
    state: b.state ?? "",
    pincode: b.pincode ?? "",
    phone: sanitizeTenDigitPhone(b.phone),
    email: b.email ?? "",
    managerName: b.managerName ?? "",
    managerPhone: sanitizeTenDigitPhone(b.managerPhone ?? ""),
    isActive: b.isActive,
  };
}

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  branch: Branch | null;
  onSubmit: (values: BranchFormValues) => void;
}

export function BranchFormDialog({ open, onOpenChange, mode, branch, onSubmit }: BranchFormDialogProps) {
  const [form, setForm] = useState<BranchFormValues>(emptyForm);

  useEffect(() => {
    if (open) {
      queueMicrotask(() =>
        setForm(mode === "edit" && branch ? branchToForm(branch) : emptyForm())
      );
    }
  }, [open, mode, branch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) return;
    if (!form.city.trim() || !form.state.trim() || !form.pincode.trim() || !form.phone.trim()) return;
    if (form.phone.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    if (form.managerPhone.trim() && form.managerPhone.length !== 10) {
      toast.error("Lead phone must be a valid 10-digit mobile number");
      return;
    }
    onSubmit(form);
    onOpenChange(false);
  };

  const title = mode === "add" ? "Add location" : "Edit location";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
              <Pencil className="h-5 w-5 text-teal-700 dark:text-teal-300" />
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bf-name">
                Site name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. MY DETAIL OS Indiranagar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-code">
                Short code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
                placeholder="APEX-IND"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bf-address">
                Street address <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bf-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                required
                rows={3}
                placeholder="Building, street, area"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-state">
                State <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-state"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                required
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-pin">
                PIN <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-pin"
                value={form.pincode}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                required
                placeholder="560034"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bf-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: sanitizeTenDigitPhone(e.target.value) }))
                }
                required
                inputMode="tel"
                maxLength={10}
                placeholder="10-digit mobile"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-email">Email</Label>
              <Input
                id="bf-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="site@yourbusiness.com"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Site lead (optional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bf-mgr-name">Lead name</Label>
                <Input
                  id="bf-mgr-name"
                  value={form.managerName}
                  onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                  placeholder="Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bf-mgr-phone">Lead phone</Label>
                <Input
                  id="bf-mgr-phone"
                  value={form.managerPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, managerPhone: sanitizeTenDigitPhone(e.target.value) }))
                  }
                  inputMode="tel"
                  maxLength={10}
                  placeholder="10-digit mobile"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="bf-active"
              checked={form.isActive}
              onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c === true }))}
            />
            <Label htmlFor="bf-active" className="text-sm font-normal cursor-pointer">
              Site is accepting work
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {mode === "add" ? "Create site" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
