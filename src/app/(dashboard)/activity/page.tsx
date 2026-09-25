"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivityLogStore } from "@/store/activity-log-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedActivityLogs } from "@/hooks/use-scoped-data";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDateTime } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  ArrowRightLeft,
  CreditCard,
  UserPlus,
  CheckCircle2,
  XCircle,
  Package,
  ClipboardList,
  Users,
  Car,
  Receipt,
  Calendar,
  UserCog,
  CalendarDays,
  MessageCircle,
  Mail,
  RefreshCw,
  Wallet,
  FileText,
  Banknote,
  Gift,
  Activity,
  Trash2,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import type { ActivityAction, ActivityEntityType, ActivityLog } from "@/types";
import { buildApiUrl } from "@/lib/api-base";
import { useAuthStore } from "@/store/auth-store";

const ACTION_ICON_MAP: Record<string, { icon: React.ElementType; className: string }> = {
  // Frontend Actions
  CREATED: { icon: Plus, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  UPDATED: { icon: Pencil, className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  DELETED: { icon: Trash2, className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  STATUS_CHANGED: { icon: ArrowRightLeft, className: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  PAYMENT_RECEIVED: { icon: CreditCard, className: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
  LOGIN: { icon: LogIn, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  LOGOUT: { icon: LogOut, className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  
  // Backend Actions
  CREATE: { icon: Plus, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  UPDATE: { icon: Pencil, className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  DELETE: { icon: Trash2, className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  UPDATE_STATUS: { icon: ArrowRightLeft, className: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  RECORD_PAYMENT: { icon: CreditCard, className: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
  ASSIGNED: { icon: UserPlus, className: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
  COMPLETED: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  CANCELLED: { icon: XCircle, className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  STOCK_ADJUSTED: { icon: Package, className: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  WHATSAPP_SENT: { icon: MessageCircle, className: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  EMAIL_SENT: { icon: Mail, className: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" },
  MECHANIC_SWITCHED: { icon: RefreshCw, className: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" },
  OWNERSHIP_TRANSFERRED: { icon: ArrowRightLeft, className: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  WALLET_CREDITED: { icon: Wallet, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  WALLET_DEBITED: { icon: Wallet, className: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
};

const ENTITY_ICON_MAP: Record<ActivityEntityType, React.ElementType> = {
  JOB_CARD: ClipboardList,
  CUSTOMER: Users,
  VEHICLE: Car,
  INVOICE: Receipt,
  APPOINTMENT: Calendar,
  INVENTORY: Package,
  STAFF: UserCog,
  LEAVE: CalendarDays,
  PAYROLL: Wallet,
  STAFF_REWARD: Gift,
  QUOTATION: FileText,
  EXPENSE: Banknote,
  WALLET: Wallet,
  NOTIFICATION: MessageCircle,
  SERVICE_REMINDER: CalendarDays,
};

const ENTITY_ROUTE_MAP: Record<ActivityEntityType, string> = {
  JOB_CARD: "/job-cards",
  CUSTOMER: "/customers",
  VEHICLE: "/vehicles",
  INVOICE: "/billing",
  APPOINTMENT: "/appointments",
  INVENTORY: "/inventory",
  STAFF: "/staff",
  LEAVE: "/leave",
  PAYROLL: "/payroll",
  STAFF_REWARD: "/rewards",
  QUOTATION: "/quotations",
  EXPENSE: "/reports",
  WALLET: "/customers",
  NOTIFICATION: "/notifications",
  SERVICE_REMINDER: "/reminders",
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  DELETED: "Deleted",
  STATUS_CHANGED: "Status Changed",
  PAYMENT_RECEIVED: "Payment Received",
  LOGIN: "Login",
  LOGOUT: "Logout",
  
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  UPDATE_STATUS: "Status Changed",
  RECORD_PAYMENT: "Payment Received",
  ASSIGNED: "Assigned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  STOCK_ADJUSTED: "Stock Adjusted",
  WHATSAPP_SENT: "WhatsApp Sent",
  EMAIL_SENT: "Email Sent",
  MECHANIC_SWITCHED: "Mechanic Switched",
  OWNERSHIP_TRANSFERRED: "Ownership Transferred",
  WALLET_CREDITED: "Wallet Credited",
  WALLET_DEBITED: "Wallet Debited",
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  JOB_CARD: "Job Card",
  CUSTOMER: "Customer",
  VEHICLE: "Vehicle",
  INVOICE: "Invoice",
  APPOINTMENT: "Appointment",
  INVENTORY: "Inventory",
  STAFF: "Staff",
  LEAVE: "Leave",
  PAYROLL: "Payroll",
  STAFF_REWARD: "Staff Reward",
  QUOTATION: "Quotation",
  EXPENSE: "Expense",
  WALLET: "Wallet",
  NOTIFICATION: "Notification",
  SERVICE_REMINDER: "Service Reminder",
};

function formatLogDetails(log: any): string {
  if (typeof log.details === "string") return log.details;
  
  if (typeof log.details === "object" && log.details !== null) {
    const details = log.details as Record<string, any>;
    
    if (log.action === "UPDATE_STATUS" && details.oldStatus && details.newStatus) {
      return `Status changed from ${details.oldStatus} to ${details.newStatus}`;
    }
    
    if (log.action === "RECORD_PAYMENT" && details.amount) {
      return `Recorded payment of ₹${details.amount}`;
    }
    
    // Generic fallback for empty objects or unknown objects
    const actionName = ACTION_LABELS[log.action] || log.action;
    return `${actionName} ${log.entityLabel}`;
  }
  
  return String(log.details);
}

export default function ActivityPage() {
  const router = useRouter();
  const logs = useScopedActivityLogs();
  const { hasMore, isLoadingMore, fetchNextPage } = useActivityLogStore();
  
  const { viewingLabel } = useBranchScope();
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Load ALL activity pages so older seed/history rows are not truncated at pageSize.
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const pageSize = 100;
        let page = 1;
        let totalPages = 1;
        const all: ActivityLog[] = [];

        while (page <= totalPages) {
          const url = buildApiUrl(
            `/api/collections/activityLogs?page=${page}&pageSize=${pageSize}`
          );
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
            signal: ac.signal,
          });
          const body = (await res.json()) as {
            data: {
              items?: ActivityLog[];
              page?: number;
              pageSize?: number;
              totalPages?: number;
            } | null;
            error: { message?: string } | null;
          };
          if (ac.signal.aborted) return;
          if (!res.ok || body.error) {
            throw new Error(body.error?.message || `HTTP ${res.status}`);
          }
          const data = body.data ?? { items: [] };
          const items = Array.isArray(data.items) ? data.items : [];
          all.push(...items);
          totalPages = Math.max(1, data.totalPages || 1);
          page += 1;
          // Safety: avoid runaway loops if API misreports totalPages
          if (page > 50) break;
        }

        if (ac.signal.aborted) return;
        useActivityLogStore.getState().setInitialPage(
          all,
          totalPages,
          pageSize,
          totalPages
        );
      } catch (err) {
        if (ac.signal.aborted) return;
        console.warn("[activity] Failed to load activityLogs:", err);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLogElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchNextPage();
      }
    }, { threshold: 0.5 });
    
    if (node) observer.current.observe(node);
  }, [isLoadingMore, hasMore, fetchNextPage]);

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  const sorted = useMemo(() => {
    let result = [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (entityFilter !== "all") {
      result = result.filter((l) => l.entityType === entityFilter);
    }
    if (actionFilter !== "all") {
      result = result.filter((l) => l.action === actionFilter);
    }
    return result;
  }, [entityFilter, actionFilter, logs]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof sorted> = {};
    sorted.forEach((log) => {
      const date = new Date(log.createdAt).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return groups;
  }, [sorted]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Activity Log"
        description={`Track actions for ${viewingLabel}. Job, invoice, and expense events respect branch scope.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {(Object.keys(ENTITY_LABELS) as ActivityEntityType[]).map((key) => (
              <SelectItem key={key} value={key}>{ENTITY_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {(Object.keys(ACTION_LABELS) as ActivityAction[]).map((key) => (
              <SelectItem key={key} value={key}>{ACTION_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, logs]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{date}</h3>
            <Card>
              <CardContent className="!p-0 divide-y divide-border">
                {logs.map((log, index) => {
                  const actionStyle = ACTION_ICON_MAP[log.action as ActivityAction] || { 
                    icon: Activity, 
                    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" 
                  };
                  const ActionIcon = actionStyle.icon;
                  const EntityIcon = ENTITY_ICON_MAP[log.entityType as ActivityEntityType] || FileText;
                  const route = ENTITY_ROUTE_MAP[log.entityType as ActivityEntityType];
                  const hasDetailRoute = !["EXPENSE"].includes(log.entityType);

                  const isLastLog = log.id === sorted[sorted.length - 1].id;

                  return (
                    <div
                      ref={isLastLog ? lastLogElementRef : undefined}
                      key={log.id ? `${log.id}-${index}` : `log-${index}`}
                      className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        if (route && log.entityId && hasDetailRoute) {
                          router.push(`${route}/${log.entityId}`);
                        } else if (route && !hasDetailRoute) {
                          router.push(route);
                        }
                      }}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${actionStyle.className}`}>
                        <ActionIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {formatLogDetails(log)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-[8px] bg-muted">{getInitials(log.userName)}</AvatarFallback>
                            </Avatar>
                            {log.userName}
                          </div>
                          <span>&middot;</span>
                          <div className="flex items-center gap-1">
                            <EntityIcon className="w-3 h-3" />
                            {log.entityLabel}
                          </div>
                          <span className="hidden sm:inline">&middot;</span>
                          <span className="hidden sm:inline">{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium hidden md:inline-flex ${actionStyle.className}`}>
                        {ACTION_LABELS[log.action]}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {loading && sorted.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isLoadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No activity found matching your filters.
        </div>
      )}
    </div>
  );
}
