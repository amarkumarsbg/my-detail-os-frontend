"use client";

import { useState } from "react";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Share2, Copy, Users, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

function buildReferralMessage(code: string) {
  return `Use my referral code ${code} at MY DETAIL OS and get exclusive rewards! Book your service today.`;
}

export default function ReferralPage() {
  const { user } = useCustomerAuthStore();
  const { customer } = useCustomerDashboardStore();
  const [shareOpen, setShareOpen] = useState(false);

  const referralCode = customer?.referralCode || user?.referralCode || "";
  const message = referralCode ? buildReferralMessage(referralCode) : "";

  const copyCode = () => {
    if (!referralCode) return;
    void navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied!");
  };

  const copyMessage = () => {
    if (!message) return;
    void navigator.clipboard.writeText(message);
    toast.success("Referral message copied!");
    setShareOpen(false);
  };

  const shareViaWhatsApp = () => {
    if (!message) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShareOpen(false);
  };

  const shareViaSms = () => {
    if (!message) return;
    window.open(`sms:?&body=${encodeURIComponent(message)}`, "_self");
    setShareOpen(false);
  };

  const shareViaEmail = () => {
    if (!message) return;
    const subject = encodeURIComponent("MY DETAIL OS Referral");
    const body = encodeURIComponent(message);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    setShareOpen(false);
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
            <Button className="flex-1" onClick={() => setShareOpen(true)} disabled={!referralCode}>
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

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md" mobileVariant="sheet">
          <DialogHeader>
            <DialogTitle>Share referral code</DialogTitle>
            <DialogDescription>
              Invite friends with your code <span className="font-mono font-medium text-foreground">{referralCode}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
            {message}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={shareViaWhatsApp}>
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
              <span className="text-xs font-medium">WhatsApp</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={shareViaSms}>
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs font-medium">Messages</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={shareViaEmail}>
              <Mail className="h-5 w-5" />
              <span className="text-xs font-medium">Email</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={copyMessage}>
              <Copy className="h-5 w-5" />
              <span className="text-xs font-medium">Copy message</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
