"use client";

import { useMemo, useState, useEffect } from "react";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStaffStore } from "@/store/staff-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { useJobCardStore } from "@/store/job-card-store";
import { Badge } from "@/components/ui/badge";
import { userCanEdit, userCanDelete } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { ApiError } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";
import { getStaffJobStats } from "@/lib/staff-job-stats";
import { getAssignableStaffRoles, canManageStaffUsers, canCreateStaffAccounts, roleDisplayLabel } from "@/lib/rbac";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Shield,
  UserCog,
  Headset,
  WrenchIcon,
  ClipboardList,
  IndianRupee,
  Crown,
  Building2,
  UserCheck,
  Eye,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Users,
  UserX,
  MailCheck,
  Loader2,
} from "lucide-react";
import type { User, UserRole } from "@/types";
import { toast } from "sonner";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";
import { StaffAccessSelector } from "@/components/staff/staff-access-selector";
import type { StaffAccessLevel } from "@/lib/staff-access";
import { buildInitialPermissions } from "@/lib/staff-role-defaults";

const ROLE_BADGE_MAP: Record<
  UserRole,
  { label: string; className: string; icon: React.ElementType }
> = {
  PLATFORM_OWNER: {
    label: "Platform Owner",
    className:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    icon: Crown,
  },
  SUPER_ADMIN: {
    label: "Super Admin",
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    icon: Crown,
  },
  ADMIN: {
    label: "Admin",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: Shield,
  },
  BRANCH_MANAGER: {
    label: "Branch Manager",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    icon: Building2,
  },
  MANAGER: {
    label: "Manager",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: UserCog,
  },
  SUPERVISOR: {
    label: "Supervisor",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    icon: UserCheck,
  },
  RECEPTIONIST: {
    label: "Receptionist",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Headset,
  },
  MECHANIC: {
    label: "Mechanic",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: WrenchIcon,
  },
  CUSTOMER: {
    label: "Customer",
    className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    icon: Users,
  },
};

const FALLBACK_ROLE_BADGE = {
  label: "Unknown role",
  className: "bg-muted text-muted-foreground",
  icon: Users,
} as const;

function roleBadgeFor(role: string | undefined | null) {
  if (role && role in ROLE_BADGE_MAP) {
    return ROLE_BADGE_MAP[role as UserRole];
  }
  return {
    ...FALLBACK_ROLE_BADGE,
    label: role?.trim() ? role : FALLBACK_ROLE_BADGE.label,
  };
}

const ALL_ROLES_FILTER: (UserRole | "ALL")[] = [
  "ALL",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
];

/** Roles shown in the Add User form (UI only — backend role values unchanged). Super Admin is not assignable here. */
const ADD_USER_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "BRANCH_MANAGER", label: "Branch Manager" },
  { value: "MANAGER", label: "Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "RECEPTIONIST", label: "Receptionist" },
];

/** Users tab directory: office roles + Super Admin (counted as a user, not staff). */
const USER_DIRECTORY_ROLES = new Set<UserRole>([
  "SUPER_ADMIN",
  ...ADD_USER_ROLE_OPTIONS.map((option) => option.value),
]);

const USER_ROLES_FILTER: (UserRole | "ALL")[] = [
  "ALL",
  "SUPER_ADMIN",
  ...ADD_USER_ROLE_OPTIONS.map((o) => o.value),
];

const STAFF_ROLES_FILTER: (UserRole | "ALL")[] = ALL_ROLES_FILTER.filter(
  (role) => role === "ALL" || !USER_DIRECTORY_ROLES.has(role)
);

/** Roles shown in the Add Staff form (Super Admin cannot be assigned here). */
const ADD_STAFF_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MECHANIC", label: "Mechanic" },
];

function suggestAddUserEmail(name: string, phoneDigits: string, existingEmails: Set<string>): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  const base = `${slug || "user"}.${phoneDigits}`;
  let email = `${base}@primecarwash.local`;
  if (!existingEmails.has(email.toLowerCase())) return email;
  return `${base}.${Date.now().toString(36)}@primecarwash.local`;
}

export default function StaffPage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const authRole = useAuthStore((s) => s.user?.role);
  const authPermissions = useAuthStore((s) => s.user?.permissions);
  const authUser = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const defaultBranchId = branches.find((b) => b.isActive)?.id ?? branches[0]?.id ?? "br-main";
  const branchLocked =
    authRole === "BRANCH_MANAGER" || authRole === "MANAGER";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<"staff" | "users">("staff");
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deletingUserBusy, setDeletingUserBusy] = useState(false);
  const staff = useStaffStore((s) => s.staff);
  const addStaff = useStaffStore((s) => s.addStaff);
  const deleteStaff = useStaffStore((s) => s.deleteStaff);
  const jobCards = useJobCardStore((s) => s.jobCards);

  const [mainTab, setMainTab] = useState<"staff" | "users">("staff");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<UserRole | "ALL">("ALL");
  const [filterUserRole, setFilterUserRole] = useState<UserRole | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [filterUserStatus, setFilterUserStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [tablePageSize, setTablePageSize] = useState(20);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [userFilterSheetOpen, setUserFilterSheetOpen] = useState(false);

  const activeStaffFilterCount =
    (filterRole !== "ALL" ? 1 : 0) +
    (filterStatus !== "ALL" ? 1 : 0) +
    (showBranchPicker && filterBranch !== "all" ? 1 : 0);

  const activeUserFilterCount =
    (filterUserRole !== "ALL" ? 1 : 0) +
    (filterUserStatus !== "ALL" ? 1 : 0) +
    (showBranchPicker && filterBranch !== "all" ? 1 : 0);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("BRANCH_MANAGER");
  const [newAccess, setNewAccess] = useState<StaffAccessLevel>("withEditAccess");
  const [newBranchId, setNewBranchId] = useState(defaultBranchId);

  const assignableRoles = useMemo(() => getAssignableStaffRoles(authRole, authPermissions), [authRole, authPermissions]);
  const addUserRoleOptions = useMemo(
    () =>
      ADD_USER_ROLE_OPTIONS.filter((option) => assignableRoles.includes(option.value)),
    [assignableRoles]
  );
  const addStaffRoleOptions = useMemo(
    () =>
      ADD_STAFF_ROLE_OPTIONS.filter((option) => assignableRoles.includes(option.value)),
    [assignableRoles]
  );
  const activeAddRoleOptions =
    addDialogMode === "users" ? addUserRoleOptions : addStaffRoleOptions;
  const canManageUsers = canManageStaffUsers(authRole);

  useEffect(() => {
    if (!dialogOpen) return;
    if (
      activeAddRoleOptions.length &&
      !activeAddRoleOptions.some((option) => option.value === newRole)
    ) {
      queueMicrotask(() => setNewRole(activeAddRoleOptions[0]!.value));
    }
  }, [dialogOpen, activeAddRoleOptions, newRole]);

  useEffect(() => {
    if (branchLocked && authUser?.branchId) {
      queueMicrotask(() => setNewBranchId(authUser.branchId));
      return;
    }
    queueMicrotask(() => {
      setNewBranchId((prev) => {
        if (branches.some((b) => b.id === prev)) return prev;
        return defaultBranchId;
      });
    });
  }, [branches, defaultBranchId, branchLocked, authUser?.branchId]);

  useEffect(() => {
    if (!showBranchPicker) {
      queueMicrotask(() => setFilterBranch("all"));
    }
  }, [showBranchPicker, selectedBranchId]);

  const branchScopedStaff = useMemo(
    () =>
      applyBranchFilters(
        staff,
        (s) => s.branchId,
        selectedBranchId,
        showBranchPicker,
        filterBranch
      ),
    [staff, selectedBranchId, showBranchPicker, filterBranch]
  );

  const branchScopeLabel = useMemo(
    () => resolveBranchScopeLabel(showBranchPicker, viewingLabel, filterBranch, branches),
    [showBranchPicker, viewingLabel, filterBranch, branches]
  );

  const staffJobStatsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getStaffJobStats>>();
    for (const s of staff) {
      map.set(s.id, getStaffJobStats(jobCards, s.id));
    }
    return map;
  }, [staff, jobCards]);

  const branchScopedStaffOnly = useMemo(
    () => branchScopedStaff.filter((s) => !USER_DIRECTORY_ROLES.has(s.role)),
    [branchScopedStaff]
  );

  const branchScopedUsers = useMemo(
    () => branchScopedStaff.filter((s) => USER_DIRECTORY_ROLES.has(s.role)),
    [branchScopedStaff]
  );

  const resetAddForm = (mode: "staff" | "users" = addDialogMode) => {
    setNewName("");
    setNewPhone("");
    setNewRole(
      mode === "users"
        ? addUserRoleOptions[0]?.value ?? "BRANCH_MANAGER"
        : addStaffRoleOptions.find((option) => option.value === "MECHANIC")?.value ??
            addStaffRoleOptions[0]?.value ??
            "MECHANIC"
    );
    setNewAccess("withEditAccess");
    setNewBranchId(branchLocked && authUser?.branchId ? authUser.branchId : defaultBranchId);
  };

  const openAddDialog = (mode: "staff" | "users") => {
    setAddDialogMode(mode);
    resetAddForm(mode);
    setDialogOpen(true);
  };

  const filteredStaff = useMemo(() => {
    return branchScopedStaffOnly.filter((s) => {
      if (filterRole !== "ALL" && s.role !== filterRole) return false;
      if (filterStatus === "ACTIVE" && !s.isActive) return false;
      if (filterStatus === "INACTIVE" && s.isActive) return false;
      return true;
    });
  }, [branchScopedStaffOnly, filterRole, filterStatus]);

  const filteredUsers = useMemo(() => {
    return branchScopedUsers.filter((s) => {
      if (filterUserRole !== "ALL" && s.role !== filterUserRole) return false;
      if (filterUserStatus === "ACTIVE" && !s.isActive) return false;
      if (filterUserStatus === "INACTIVE" && s.isActive) return false;
      return true;
    });
  }, [branchScopedUsers, filterUserRole, filterUserStatus]);

  const staffStats = useMemo(() => {
    const total = branchScopedStaffOnly.length;
    const active = branchScopedStaffOnly.filter((s) => s.isActive).length;
    const verified = branchScopedStaffOnly.filter((s) => s.emailVerified).length;
    return { total, active, inactive: total - active, verified };
  }, [branchScopedStaffOnly]);

  const userStats = useMemo(() => {
    const total = branchScopedUsers.length;
    const active = branchScopedUsers.filter((s) => s.isActive).length;
    const verified = branchScopedUsers.filter((s) => s.emailVerified).length;
    return { total, active, inactive: total - active, verified };
  }, [branchScopedUsers]);

  const columns = useMemo(
    () => [
      {
        key: "employeeCode",
        label: "Emp. Code",
        render: (item: User) => (
          <span className="font-mono text-xs text-muted-foreground">
            {item.employeeCode?.trim() || "—"}
          </span>
        ),
      },
      {
        key: "name",
        label: "Name",
        render: (item: User) => (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {resolveUploadsPublicUrl(item.avatar) ? (
                <AvatarImage src={resolveUploadsPublicUrl(item.avatar)!} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        label: "Phone",
        render: (item: User) =>
          item.phone?.trim() ? (
            <span>{item.phone}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "role",
        label: "Role",
        render: (item: User) => {
          const badge = roleBadgeFor(item.role);
          const Icon = badge.icon;
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {badge.label}
            </span>
          );
        },
      },
      {
        key: "designation",
        label: "Designation",
        className: "hidden lg:table-cell",
        render: (item: User) => (
          <span className="text-sm">{item.designation?.trim() || "—"}</span>
        ),
      },
      {
        key: "department",
        label: "Department",
        className: "hidden xl:table-cell",
        render: (item: User) => (
          <span className="text-sm">{item.department?.trim() || "—"}</span>
        ),
      },
      {
        key: "joiningDate",
        label: "Joined",
        className: "hidden xl:table-cell",
        render: (item: User) => (
          <span className="text-sm tabular-nums">{item.joiningDate?.trim() || "—"}</span>
        ),
      },
      {
        key: "branchId",
        label: "Branch",
        render: (item: User) => {
          const branch = branches.find((b) => b.id === item.branchId);
          return <span className="text-sm">{branch?.name ?? "—"}</span>;
        },
      },
      {
        key: "isActive",
        label: "Status",
        render: (item: User) => (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${item.isActive ? "bg-emerald-500" : "bg-gray-400"}`}
            />
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "jobs",
        label: "Jobs",
        className: "hidden lg:table-cell",
        render: (item: User) => {
          const stats = staffJobStatsById.get(item.id);
          if (!stats || stats.total === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="text-sm tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {stats.completed}
              </span>
              <span className="text-muted-foreground"> done · </span>
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                {stats.active}
              </span>
              <span className="text-muted-foreground"> ongoing</span>
            </span>
          );
        },
      },
      {
        key: "incentive",
        label: "Incentive",
        className: "hidden xl:table-cell",
        render: (item: User) => {
          const earned = staffJobStatsById.get(item.id)?.totalIncentiveEarned ?? 0;
          if (earned <= 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="w-3.5 h-3.5" />
              {earned.toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        key: "actions",
        label: "Actions",
        render: (item: User) => (
          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/staff/${item.id}`} aria-label="View">
                <Eye className="w-4 h-4 text-blue-600" />
              </Link>
            </Button>
            {userCanEdit(useAuthStore.getState().user, "STAFF") && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/staff/${item.id}`} aria-label="Edit">
                  <Pencil className="w-4 h-4 text-violet-600" />
                </Link>
              </Button>
            )}
            {userCanDelete(useAuthStore.getState().user, "STAFF") && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                disabled={deletingUserBusy}
                aria-label="Delete"
                onClick={() => setDeletingUser(item)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [staff, branches, staffJobStatsById, canManageUsers, deletingUserBusy]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreateStaffAccounts(authRole)) {
      toast.error("Only Super Admin or Admin can create user accounts.");
      return;
    }
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name || !phone) {
      toast.error("Please enter name and mobile number.");
      return;
    }
    // Accept formats like 9876543210, +919876543210, +91-98765-43210, etc.
    const digits = phone.replace(/[\s\-()]/g, "");
    const phoneDigits = digits.startsWith("+91") ? digits.slice(3) : digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
    if (!/^\d{10}$/.test(phoneDigits)) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!activeAddRoleOptions.some((option) => option.value === newRole)) {
      toast.error("Please select a valid role.");
      return;
    }
    const existingEmails = new Set(staff.map((s) => s.email.toLowerCase()));
    const email = suggestAddUserEmail(name, phoneDigits, existingEmails);
    if (existingEmails.has(email.toLowerCase())) {
      toast.error("A staff member with this email already exists.");
      return;
    }
    let maxNumber = 0;
    for (const s of staff) {
      if (s.employeeCode && s.employeeCode.startsWith("EMP-")) {
        const numStr = s.employeeCode.replace("EMP-", "");
        const num = parseInt(numStr, 10);
        if (!Number.isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    const finalEmployeeCode = `EMP-${String(maxNumber + 1).padStart(3, "0")}`;

    const branchId = branchLocked && authUser?.branchId ? authUser.branchId : newBranchId;
    const permissions = buildInitialPermissions(
      newRole,
      addDialogMode === "users" ? newAccess : "withEditAccess"
    );
    setCreatingUser(true);
    try {
      const { temporaryPassword, credentialsEmailSent } = await addStaff({
        name,
        email,
        phone,
        role: newRole,
        branchId,
        isActive: true,
        employeeCode: finalEmployeeCode,
        isAttendanceTracked: true,
        ...(permissions.length > 0 ? { permissions } : {}),
      });
      pushActivityLog({
        action: "CREATED",
        entityType: "STAFF",
        entityId: email,
        entityLabel: name,
        details: `Staff created (${finalEmployeeCode})`,
      });
      if (temporaryPassword) {
        toast.success(addDialogMode === "users" ? "User created." : "Staff member created.", {
          description: `${credentialsEmailSent ? "Credentials emailed. " : ""}Temporary password (copy now — not stored): ${temporaryPassword}`,
          duration: credentialsEmailSent ? 20_000 : 45_000,
        });
      } else {
        toast.success(addDialogMode === "users" ? "User created successfully." : "Staff member created successfully.");
      }
      resetAddForm(addDialogMode);
      setDialogOpen(false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "USER_LIMIT_REACHED") {
          const currentUsers =
            typeof e.details?.currentUsers === "number" ? e.details.currentUsers : null;
          const maxUsers = typeof e.details?.maxUsers === "number" ? e.details.maxUsers : null;
          const planName =
            typeof e.details?.planName === "string" ? e.details.planName : "your current";
          toast.error(e.message, {
            description:
              currentUsers !== null && maxUsers !== null
                ? `${currentUsers}/${maxUsers} users used on ${planName} plan.`
                : undefined,
          });
          return;
        }
        toast.error(e.message);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not create user. Check API server and try again.");
    } finally {
      setCreatingUser(false);
    }
  };

  if (!storesReady && staff.length === 0) return <PageSkeleton />;

  const addAccountDialog = canCreateStaffAccounts(authRole) ? (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetAddForm(addDialogMode);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{addDialogMode === "users" ? "Add User" : "Add Staff"}</DialogTitle>
          <DialogDescription>
            {addDialogMode === "users"
              ? "Create an office user account with role and access level."
              : "Create a workshop staff account such as a mechanic."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                placeholder="+91-9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                required
              />
              {(() => {
                const raw = newPhone.trim();
                if (!raw) return null;
                const digits = raw.replace(/[\s\-()]/g, "");
                const core = digits.startsWith("+91") ? digits.slice(3) : digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
                if (!/^\d{10}$/.test(core)) {
                  return <p className="text-xs text-destructive">Enter a valid 10-digit mobile number.</p>;
                }
                return null;
              })()}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="role">{addDialogMode === "users" ? "User Role" : "Staff Role"}</Label>
              <Select
                required
                disabled={activeAddRoleOptions.length === 0}
                value={newRole}
                onValueChange={(v) => setNewRole(v as UserRole)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {activeAddRoleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addDialogMode === "users" ? (
              <div className="space-y-2 sm:col-span-2">
                <StaffAccessSelector
                  value={newAccess}
                  onChange={setNewAccess}
                  name="add-user-access"
                />
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={creatingUser}>
              Cancel
            </Button>
            <Button type="submit" disabled={creatingUser || activeAddRoleOptions.length === 0}>
              {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {creatingUser ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Users & Staff"
        description="Manage staff accounts, office users, roles, and attendance PINs."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateStaffAccounts(authRole) && mainTab === "staff" ? (
              <Button
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={() => openAddDialog("staff")}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Staff
              </Button>
            ) : null}
            {canCreateStaffAccounts(authRole) && mainTab === "users" ? (
              <Button
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={() => openAddDialog("users")}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add User
              </Button>
            ) : null}
          </div>
        }
      />

      {addAccountDialog}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "staff" | "users")}>
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4 flex flex-col gap-3 md:gap-4">
          <div className="order-1 md:order-3">
            <h2 className="mb-2 text-sm font-semibold">Staff list</h2>
            <DataTable
              data={filteredStaff}
              columns={columns}
              searchPlaceholder="Search staff…"
              searchKeys={["name", "email", "phone", "role", "id"]}
              pageSize={tablePageSize}
              onRowClick={(item) => router.push(`/staff/${item.id}`)}
              actions={
                <Button
                  type="button"
                  variant={activeStaffFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs md:hidden"
                  onClick={() => setFilterSheetOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  Filters
                  {activeStaffFilterCount > 0 ? (
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold leading-none">
                      {activeStaffFilterCount}
                    </span>
                  ) : null}
                </Button>
              }
              renderMobileCard={(item) => {
                const u = item as User;
                const badge = roleBadgeFor(u.role);
                const Icon = badge.icon;
                const branch = branches.find((b) => b.id === u.branchId);
                return (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        {resolveUploadsPublicUrl(u.avatar) ? (
                          <AvatarImage src={resolveUploadsPublicUrl(u.avatar)!} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {u.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        <Icon className="size-2.5 shrink-0" />
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {u.phone?.trim() || "No phone"}
                        {showBranchPicker ? ` · ${branch?.name ?? "—"}` : ""}
                      </span>
                    </div>
                  </>
                );
              }}
            />
          </div>

          <div className="order-2 grid grid-cols-2 gap-2 md:order-1 lg:grid-cols-4 md:gap-3">
            <KPICard
              size="compact"
              title="Total staff"
              value={staffStats.total}
              icon={Users}
              tone="violet"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Active"
              value={staffStats.active}
              icon={UserCheck}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Inactive"
              value={staffStats.inactive}
              icon={UserX}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Verified email"
              value={staffStats.verified}
              icon={MailCheck}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
          </div>

          <Card className="order-3 hidden md:order-2 md:block">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {showBranchPicker ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Filter by branch</Label>
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by role</Label>
                  <Select
                    value={filterRole}
                    onValueChange={(v) => setFilterRole(v as UserRole | "ALL")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES_FILTER.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "ALL" ? "All roles" : roleDisplayLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Items per page</Label>
                  <Select
                    value={String(tablePageSize)}
                    onValueChange={(v) => setTablePageSize(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showBranchPicker ? (
                <p className="text-xs text-muted-foreground">
                  Showing staff for:{" "}
                  <span className="font-medium text-foreground">{branchScopeLabel}</span>
                  {filterBranch === "all" ? (
                    <span>
                      {" "}
                      — pick a branch in this filter or use the header switcher to narrow the list.
                    </span>
                  ) : null}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <MobileFilterSheet
            open={filterSheetOpen}
            onOpenChange={setFilterSheetOpen}
            title="Staff filters"
            activeCount={activeStaffFilterCount}
            onReset={() => {
              setFilterBranch("all");
              setFilterRole("ALL");
              setFilterStatus("ALL");
              setTablePageSize(20);
            }}
          >
            {showBranchPicker ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Branch</p>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Select
                value={filterRole}
                onValueChange={(v) => setFilterRole(v as UserRole | "ALL")}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES_FILTER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "ALL" ? "All roles" : roleDisplayLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Items per page</p>
              <Select
                value={String(tablePageSize)}
                onValueChange={(v) => setTablePageSize(Number(v))}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterSheet>
        </TabsContent>

        <TabsContent value="users" className="mt-4 flex flex-col gap-3 md:gap-4">
          <div className="order-1 md:order-3">
            <h2 className="mb-2 text-sm font-semibold">Users list</h2>
            <DataTable
              data={filteredUsers}
              columns={columns}
              searchPlaceholder="Search users…"
              searchKeys={["name", "email", "phone", "role", "id"]}
              pageSize={tablePageSize}
              onRowClick={(item) => router.push(`/staff/${item.id}`)}
              actions={
                <Button
                  type="button"
                  variant={activeUserFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs md:hidden"
                  onClick={() => setUserFilterSheetOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  Filters
                  {activeUserFilterCount > 0 ? (
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold leading-none">
                      {activeUserFilterCount}
                    </span>
                  ) : null}
                </Button>
              }
              renderMobileCard={(item) => {
                const u = item as User;
                const badge = roleBadgeFor(u.role);
                const Icon = badge.icon;
                const branch = branches.find((b) => b.id === u.branchId);
                return (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        {resolveUploadsPublicUrl(u.avatar) ? (
                          <AvatarImage src={resolveUploadsPublicUrl(u.avatar)!} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {u.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        <Icon className="size-2.5 shrink-0" />
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {u.phone?.trim() || "No phone"}
                        {showBranchPicker ? ` · ${branch?.name ?? "—"}` : ""}
                      </span>
                    </div>
                  </>
                );
              }}
            />
          </div>

          <div className="order-2 grid grid-cols-2 gap-2 md:order-1 lg:grid-cols-4 md:gap-3">
            <KPICard
              size="compact"
              title="Total users"
              value={userStats.total}
              icon={UserCog}
              tone="violet"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Active"
              value={userStats.active}
              icon={UserCheck}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Inactive"
              value={userStats.inactive}
              icon={UserX}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Verified email"
              value={userStats.verified}
              icon={MailCheck}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
          </div>

          <Card className="order-3 hidden md:order-2 md:block">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {showBranchPicker ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Filter by branch</Label>
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by role</Label>
                  <Select
                    value={filterUserRole}
                    onValueChange={(v) => setFilterUserRole(v as UserRole | "ALL")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES_FILTER.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "ALL"
                            ? "All roles"
                            : ADD_USER_ROLE_OPTIONS.find((option) => option.value === r)?.label ??
                              roleDisplayLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by status</Label>
                  <Select
                    value={filterUserStatus}
                    onValueChange={(v) => setFilterUserStatus(v as typeof filterUserStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Items per page</Label>
                  <Select
                    value={String(tablePageSize)}
                    onValueChange={(v) => setTablePageSize(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showBranchPicker ? (
                <p className="text-xs text-muted-foreground">
                  Showing users for:{" "}
                  <span className="font-medium text-foreground">{branchScopeLabel}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <MobileFilterSheet
            open={userFilterSheetOpen}
            onOpenChange={setUserFilterSheetOpen}
            title="User filters"
            activeCount={activeUserFilterCount}
            onReset={() => {
              setFilterBranch("all");
              setFilterUserRole("ALL");
              setFilterUserStatus("ALL");
              setTablePageSize(20);
            }}
          >
            {showBranchPicker ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Branch</p>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Select
                value={filterUserRole}
                onValueChange={(v) => setFilterUserRole(v as UserRole | "ALL")}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES_FILTER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "ALL"
                        ? "All roles"
                        : ADD_USER_ROLE_OPTIONS.find((option) => option.value === r)?.label ??
                          roleDisplayLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Select
                value={filterUserStatus}
                onValueChange={(v) => setFilterUserStatus(v as typeof filterUserStatus)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Items per page</p>
              <Select
                value={String(tablePageSize)}
                onValueChange={(v) => setTablePageSize(Number(v))}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterSheet>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open && !deletingUserBusy) setDeletingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete staff user?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {" "}
              <span className="font-semibold text-foreground">{deletingUser?.name}</span>? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingUserBusy}
              onClick={() => setDeletingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingUserBusy}
              onClick={async () => {
                if (!deletingUser) return;
                setDeletingUserBusy(true);
                try {
                  await deleteStaff(deletingUser.id);
                  pushActivityLog({
                    action: "STATUS_CHANGED",
                    entityType: "STAFF",
                    entityId: deletingUser.id,
                    entityLabel: deletingUser.name,
                    details: "Staff user deleted",
                  });
                  toast.success("Staff user deleted");
                  setDeletingUser(null);
                } catch (e) {
                  if (e instanceof ApiError) {
                    if (e.status === 403 || e.status === 404) {
                      toast.error(e.message);
                    } else {
                      toast.error(e.message || "Could not delete staff user.");
                    }
                  } else {
                    toast.error(
                      e instanceof Error ? e.message : "Could not delete staff user."
                    );
                  }
                } finally {
                  setDeletingUserBusy(false);
                }
              }}
            >
              {deletingUserBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
