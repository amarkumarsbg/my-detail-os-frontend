"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ReferralPage() {
  const { user } = useCustomerAuthStore();
  const { customer } = useCustomerDashboardStore();

  const referralCode = customer?.referralCode || user?.referralCode || "";

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied!");
  };

  const shareCode = () => {
    if (!referralCode) return;
    const message = `Use my referral code ${referralCode} at MY DETAIL OS and get exclusive rewards! Book your service today.`;
    if (navigator.share) {
      void navigator.share({ title: "MY DETAIL OS Referral", text: message });
    } else {
      copyCode();
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">

      {/* Code display */}
      <Card>
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Your referral code</p>
            <p className="text-3xl font-bold font-mono tracking-widest">{referralCode || "—"}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={copyCode} disabled={!referralCode}>
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button className="flex-1" onClick={shareCode} disabled={!referralCode}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { step: "1", text: "Share your referral code with friends and family." },
            { step: "2", text: "They book a service and enter your code at the time of booking." },
            { step: "3", text: "You both earn reward points once their service is completed." },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                {item.step}
              </div>
              <p className="text-sm text-muted-foreground pt-1">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
