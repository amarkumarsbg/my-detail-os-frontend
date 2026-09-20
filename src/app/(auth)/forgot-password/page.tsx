"use client";

import { useEffect } from "react";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { marketingForgotPasswordUrl } from "@/lib/marketing-site";

/** Staff password reset is on the public marketing website. */
export default function ForgotPasswordRedirectPage() {
  useEffect(() => {
    window.location.replace(marketingForgotPasswordUrl());
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="h-10 w-10 rounded-full border-2 border-teal-600/30 border-t-teal-600 animate-spin" />
      <p className="text-sm text-muted-foreground">Redirecting to password reset…</p>
      <button
        type="button"
        className="text-sm text-primary underline"
        onClick={() => goToMarketingLogin()}
      >
        Go to sign in
      </button>
    </div>
  );
}
