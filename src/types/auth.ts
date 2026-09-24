/** Org-level super user: full access including branch CRUD. */
export type UserRole =
  | "PLATFORM_OWNER"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "MANAGER"
  | "SUPERVISOR"
  | "RECEPTIONIST"
  | "MECHANIC"
  | "CUSTOMER";

export interface Branch {
  id: string;
  name: string;
  /** Street / building line */
  address: string;
  phone: string;
  isActive: boolean;
  qrCodeId?: string;
  /** Short reference label (invoices, badges) */
  code?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  avatar?: string;
  isActive: boolean;
  /** Demo flag for directory / “verified email” stats */
  emailVerified?: boolean;
  /** Demo-only attendance PIN; production should store hashes and verify via API */
  attendancePin?: string;
  totalJobsCompleted?: number;
  totalIncentiveEarned?: number;
  /** Unique staff employee code (optional; unique when set). */
  employeeCode?: string;
  /** Job title — distinct from role. */
  designation?: string;
  department?: string;
  /** Employment start date yyyy-mm-dd (separate from birthday and anniversary). */
  joiningDate?: string;
  /** ISO date yyyy-mm-dd */
  birthday?: string;
  /** Work anniversary yyyy-mm-dd (not joining date). */
  anniversary?: string;
  notes?: string;
  /** Server sets true until the user completes an authenticated password change (onboarding). */
  mustChangePassword?: boolean;
  /** Organization this staff user belongs to (from auth/me). */
  organizationId?: string;
  /** ISO timestamp when login password was last changed (server audit). */
  passwordUpdatedAt?: string;
  /** Staff user id who provisioned this account password (server audit). */
  passwordCreatedBy?: string;
  permissions?: string[];
  /** Whether the payroll system should strictly deduct absence based on missed punches. Default: true */
  isAttendanceTracked?: boolean;
  /** Individual fixed monthly basic salary (overrides role-based salary structure). */
  baseSalary?: number;
}

/**
 * Customer user account (for customer portal login).
 * Separate from Staff/Admin User type.
 */
/** Shape returned by POST /api/auth/customer/login and GET /api/auth/customer/me */
export interface CustomerUser {
  /** Customer record ID (same as customerId) */
  id: string;
  /** Alias kept for internal use — equals id */
  customerId: string;
  name: string;
  email: string;
  phone: string;
  role: "CUSTOMER"; // synthesised client-side; not in API response
  avatar?: string | null;
  address?: string;
  referralCode: string;
  referredBy?: string;
  rewardPoints: number;
  walletBalance: number;
  totalVisits?: number;
  lastVisitDate?: string;
  isInactive?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  /** True when auto-generated password is set — customer must change it on first login */
  mustChangePassword?: boolean;
}
