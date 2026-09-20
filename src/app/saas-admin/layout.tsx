"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { isPlatformOwner } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { goToMarketingHome, goToMarketingLogin } from "@/lib/marketing-site";

export default function SaasAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      queueMicrotask(() => setReady(true));
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      await useAuthStore.getState().ensureValidSession();
      const auth = useAuthStore.getState();
      if (!auth.isAuthenticated) {
        goToMarketingLogin();
        return;
      }
      if (!isPlatformOwner(auth.user?.role)) {
        router.replace("/");
      }
    })();
  }, [ready, router]);

  if (!ready || !isAuthenticated || !isPlatformOwner(user?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SaaS Owner</p>
            <Link href="/saas-admin/organizations" className="text-lg font-semibold">
              Organizations
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{user?.email}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                goToMarketingHome();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
