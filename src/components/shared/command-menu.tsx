"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types";
import { canAccessNavItem } from "@/lib/rbac";
import { isHrStaffNavHref, userHasWithoutEditAccess } from "@/lib/staff-access";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { useCustomerStore } from "@/store/customer-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useStaffStore } from "@/store/staff-store";
import {
  Users,
  Car,
  ClipboardList,
  Receipt,
  UserCog,
  Wrench,
  LayoutDashboard,
  Calendar,
  BarChart3,
  History,
  Package,
  Search,
  QrCode,
  CalendarOff,
  TrendingUp,
  FileBarChart,
  Gift,
  Building2,
  IndianRupee,
  Trophy,
} from "lucide-react";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NavPageItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  /** If set, only these roles see this shortcut (same idea as sidebar). */
  roles?: UserRole[];
  permissionKey?: string;
};

const NAV_PAGES: NavPageItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissionKey: "DASHBOARD" },
  { name: "Job Cards", href: "/job-cards", icon: ClipboardList, permissionKey: "JOB_CARDS" },
  { name: "Customers", href: "/customers", icon: Users, permissionKey: "CUSTOMERS" },
  { name: "Vehicles", href: "/vehicles", icon: Car, permissionKey: "VEHICLES" },
  { name: "Staff", href: "/staff", icon: UserCog, permissionKey: "STAFF" },
  { name: "Services", href: "/services", icon: Wrench, permissionKey: "SERVICES" },
  { name: "Inventory", href: "/inventory", icon: Package, permissionKey: "INVENTORY" },
  { name: "Billing", href: "/billing", icon: Receipt, permissionKey: "BILLING" },
  {
    name: "Accounting",
    href: "/accounting",
    icon: IndianRupee,
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
    permissionKey: "REPORTS",
  },
  { name: "Appointments", href: "/appointments", icon: Calendar, permissionKey: "APPOINTMENTS" },
  {
    name: "Attendance",
    href: "/attendance",
    icon: QrCode,
    roles: ["ADMIN", "MANAGER"],
    permissionKey: "ATTENDANCE",
  },
  { name: "Leave", href: "/leave", icon: CalendarOff, permissionKey: "LEAVE" },
  {
    name: "Rewards",
    href: "/rewards",
    icon: Trophy,
    roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
    permissionKey: "STAFF_REWARDS",
  },
  {
    name: "Performance",
    href: "/performance",
    icon: TrendingUp,
    roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
    permissionKey: "PERFORMANCE",
  },
  { name: "Analytics", href: "/reports", icon: BarChart3, permissionKey: "ANALYTICS" },
  {
    name: "Advanced Reports",
    href: "/advanced-reports",
    icon: FileBarChart,
    roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
    permissionKey: "ADVANCED_REPORTS",
  },
  { name: "Activity Log", href: "/activity", icon: History, permissionKey: "ACTIVITY" },
  { name: "Referrals", href: "/referrals", icon: Gift, roles: ["ADMIN", "MANAGER"], permissionKey: "REFERRALS" },
  {
    name: "Branch",
    href: "/branches",
    icon: Building2,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "BRANCH_MANAGER"],
    permissionKey: "BRANCHES",
  },
];

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const tenantHref = useTenantPath();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const userPermissions = user?.permissions;
  const hideHrStaffNav = userHasWithoutEditAccess(user);
  const [search, setSearch] = useState("");
  const { customers } = useCustomerStore();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const { jobCards } = useJobCardStore();
  const staff = useStaffStore((s) => s.staff);
  const invoices = useInvoiceStore((s) => s.invoices);

  const groupClass = "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-muted-foreground";
  const itemClass = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent";

  useEffect(() => {
    if (!open) queueMicrotask(() => setSearch(""));
  }, [open]);

  const visibleNavPages = useMemo(
    () =>
      NAV_PAGES.filter((p) => canAccessNavItem(p.roles, userRole, p.permissionKey, userPermissions)).filter(
        (p) => !(hideHrStaffNav && isHrStaffNavHref(p.href))
      ),
    [userRole, userPermissions, hideHrStaffNav]
  );

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(tenantHref(href));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100">
      <div
        className="fixed inset-0 bg-black/50 cursor-pointer"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-border px-4">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-2" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name, phone, email, vehicle..."
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Pages" className={groupClass}>
              {visibleNavPages.map((p) => (
                <Command.Item
                  key={p.href}
                  value={`page ${p.name}`}
                  onSelect={() => navigate(p.href)}
                  className={itemClass}
                >
                  <p.icon className="w-4 h-4 text-muted-foreground" />
                  {p.name}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Customers" className={groupClass}>
              {customers.slice(0, 10).map((c) => (
                <Command.Item
                  key={c.id}
                  value={`customer ${c.name} ${c.phone} ${c.email} ${c.address}`}
                  onSelect={() => navigate(`/customers/${c.id}`)}
                  className={itemClass}
                >
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{c.phone}</span>
                    {c.email && <span className="text-muted-foreground text-xs ml-1.5">· {c.email}</span>}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Job Cards" className={groupClass}>
              {jobCards.slice(0, 10).map((j) => (
                <Command.Item
                  key={j.id}
                  value={`job ${j.jobNumber} ${j.customerName} ${j.customerPhone} ${j.vehicleRegNumber} ${j.vehicleMakeModel} ${j.status}`}
                  onSelect={() => navigate(`/job-cards/${j.id}`)}
                  className={itemClass}
                >
                  <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{j.jobNumber}</span>
                    <span className="text-muted-foreground text-xs ml-2">{j.customerName}</span>
                    <span className="text-muted-foreground text-xs ml-1.5">· {j.vehicleRegNumber}</span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Vehicles" className={groupClass}>
              {vehicles.slice(0, 8).map((v) => (
                <Command.Item
                  key={v.id}
                  value={`vehicle ${v.registrationNumber} ${v.make} ${v.model} ${v.customerName}`}
                  onSelect={() => navigate(`/vehicles/${v.id}`)}
                  className={itemClass}
                >
                  <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{v.registrationNumber}</span>
                    <span className="text-muted-foreground text-xs ml-2">{v.make} {v.model}</span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            {!hideHrStaffNav && (
              <Command.Group heading="Staff" className={groupClass}>
                {staff.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={`staff ${s.name} ${s.phone} ${s.email} ${s.role}`}
                    onSelect={() => navigate(`/staff/${s.id}`)}
                    className={itemClass}
                  >
                    <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-xs ml-2 capitalize">{s.role.toLowerCase()}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Invoices" className={groupClass}>
              {invoices.slice(0, 6).map((inv) => (
                <Command.Item
                  key={inv.id}
                  value={`invoice ${inv.invoiceNumber} ${inv.customerName} ${inv.customerPhone} ${inv.vehicleRegNumber}`}
                  onSelect={() => navigate(`/billing/${inv.id}`)}
                  className={itemClass}
                >
                  <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <span className="text-muted-foreground text-xs ml-2">{inv.customerName}</span>
                    <span className="text-muted-foreground text-xs ml-1.5">· {inv.vehicleRegNumber}</span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
