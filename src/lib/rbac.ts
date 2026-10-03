import type { User, UserRole } from "@/types";

/** Super admin: unrestricted navigation (all routes that use role gates). */
export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function isPlatformOwner(role: UserRole | undefined): boolean {
  return role === "PLATFORM_OWNER";
}

/** Module / feature permission check. SUPER_ADMIN always passes. */
export function userHasPermission(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  permissionKey: string
): boolean {
  if (!user?.role) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return Boolean(user.permissions?.includes(permissionKey));
}

/** Can create / edit / deactivate branches on the Branch page. */
export function canManageOrgBranches(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Super Admin and Admin may onboard accounts (public signup is disabled). */
export function canCreateStaffAccounts(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Can open Staff / Users directory (view and edit existing profiles where permitted). */
export function canManageStaffUsers(role: UserRole | undefined): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "BRANCH_MANAGER" ||
    role === "MANAGER"
  );
}

/** Which staff roles an actor may assign when adding/editing team members. */
export function getAssignableStaffRoles(actorRole: UserRole | undefined, userPermissions?: string[]): UserRole[] {
  if (actorRole === "SUPER_ADMIN") {
    return [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "RECEPTIONIST",
      "MECHANIC",
    ];
  }
  if (actorRole === "ADMIN" || userPermissions?.includes("STAFF_CREATE") || userPermissions?.includes("STAFF_EDIT")) {
    return [
      "ADMIN",
      "BRANCH_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "RECEPTIONIST",
      "MECHANIC",
    ];
  }
  return [];
}

/**
 * Sidebar / command menu: SUPER_ADMIN passes all checks; BRANCH_MANAGER matches MANAGER entries.
 * Non-Super Admin users must also satisfy custom permission checks if a permissionKey is specified.
 * PLATFORM_OWNER is not a studio operator — deny studio nav.
 */
export function canAccessNavItem(
  allowed: UserRole[] | undefined,
  userRole: UserRole | undefined,
  permissionKey?: string,
  userPermissions?: string[]
): boolean {
  if (!userRole) return false;
  if (userRole === "PLATFORM_OWNER") return false;
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return true;

  // 1. Explicit Permission Check (Granular or Base)
  if (permissionKey && userPermissions) {
    if (userPermissions.includes(permissionKey)) return true;
    if (userPermissions.some((p) => p.startsWith(`${permissionKey}_`))) return true;
  }

  // 2. Role-based fallback for items without a permissionKey
  let roleAllowed = false;
  if (!allowed || allowed.length === 0) {
    roleAllowed = true;
  } else if (allowed.includes(userRole)) {
    roleAllowed = true;
  } else if (userRole === "BRANCH_MANAGER" && allowed.includes("MANAGER")) {
    roleAllowed = true;
  }

  // If the module has a permission key and the user didn't have it, deny access
  if (permissionKey) return false;

  return roleAllowed;
}

/**
 * Granular Create / View / Edit helpers.
 * Falls back to the base module key for backward compatibility —
 * existing staff with e.g. "JOB_CARDS" keep full access automatically.
 * SUPER_ADMIN and ADMIN always pass regardless of stored permissions.
 * Delete is never grantable to staff.
 */
function granularCheck(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  moduleKey: string,
  action: "CREATE" | "VIEW" | "EDIT" | "DELETE"
): boolean {
  if (!user?.role) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
  const perms = user.permissions ?? [];
  if (perms.includes(moduleKey)) return true; // base key = full access
  return perms.includes(`${moduleKey}_${action}`);
}

export function userCanCreate(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  moduleKey: string
): boolean {
  return granularCheck(user, moduleKey, "CREATE");
}

export function userCanView(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  moduleKey: string
): boolean {
  return granularCheck(user, moduleKey, "VIEW");
}

export function userCanEdit(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  moduleKey: string
): boolean {
  return granularCheck(user, moduleKey, "EDIT");
}

export function userCanDelete(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  moduleKey: string
): boolean {
  return granularCheck(user, moduleKey, "DELETE");
}

export function roleDisplayLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    PLATFORM_OWNER: "Platform Owner",
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    BRANCH_MANAGER: "Branch Manager",
    MANAGER: "Manager",
    SUPERVISOR: "Supervisor",
    RECEPTIONIST: "Receptionist",
    MECHANIC: "Mechanic",
    CUSTOMER: "Customer",
  };
  return labels[role];
}
