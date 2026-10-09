"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import {
  User,
  Trophy,
  Wallet,
  Share2,
  CreditCard,
  FileText,
  ClipboardCheck,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const menuSections = [
  {
    title: "Account",
    items: [
      { label: "My Profile", description: "View and edit your details", icon: User, href: "/customer/more/profile" },
      { label: "Memberships", description: "Your active service plans", icon: CreditCard, href: "/customer/more/memberships" },
    ],
  },
  {
    title: "Rewards & Wallet",
    items: [
      { label: "Reward Points", description: "Earn and redeem points", icon: Trophy, href: "/customer/more/rewards" },
      { label: "Wallet", description: "Balance and transactions", icon: Wallet, href: "/customer/more/wallet" },
      { label: "Referral Code", description: "Share and earn rewards", icon: Share2, href: "/customer/more/referral" },
    ],
  },
  {
    title: "Billing",
    items: [
      { label: "Invoices", description: "View all your bills", icon: FileText, href: "/customer/invoices" },
      { label: "Inspections", description: "Vehicle inspection reports", icon: ClipboardCheck, href: "/customer/inspections" },
    ],
  },
];

export default function CustomerMorePage() {
  const { user } = useCustomerAuthStore();
  const { customer, getActiveMemberships, getTotalOutstanding } = useCustomerDashboardStore();

  const activeMemberships = getActiveMemberships();
  const outstanding = getTotalOutstanding();
  const rewardPoints = customer?.rewardPoints ?? user?.rewardPoints ?? 0;
  const walletBalance = customer?.walletBalance ?? user?.walletBalance ?? 0;

  const badges: Record<string, string> = {
    "/customer/more/rewards": rewardPoints > 0 ? `${rewardPoints.toLocaleString()} pts` : "",
    "/customer/more/wallet": walletBalance > 0 ? formatCurrency(walletBalance) : "",
    "/customer/more/memberships": activeMemberships.length > 0 ? `${activeMemberships.length} active` : "",
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">{customer?.phone || user?.phone}</p>

      {outstanding > 0 && (
        <Link href="/customer/invoices">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-3 cursor-pointer hover:bg-red-100 transition-colors">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                Outstanding: {formatCurrency(outstanding)}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">Tap to view invoices</p>
            </div>
            <ChevronRight className="h-4 w-4 text-red-400 shrink-0" />
          </div>
        </Link>
      )}

      {menuSections.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {section.title}
          </p>
          <div className="rounded-xl border overflow-hidden divide-y divide-border">
            {section.items.map((item) => {
              const Icon = item.icon;
              const badge = badges[item.href];
              return (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-4 px-4 py-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    {badge && (
                      <span className="text-xs font-medium text-muted-foreground shrink-0">{badge}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
