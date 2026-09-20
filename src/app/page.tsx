"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { goToMarketingLogin } from "@/lib/marketing-site";

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      if (isAuthenticated) {
        router.replace("/dashboard");
      } else {
        goToMarketingLogin();
      }
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => {
      if (useAuthStore.getState().isAuthenticated) {
        router.replace("/dashboard");
      } else {
        goToMarketingLogin();
      }
    });
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
