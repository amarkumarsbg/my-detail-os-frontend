"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api-base";
import { PASSWORD_POLICY_HINT, validateStrongPassword } from "@/lib/password-policy";
import type { Branch, User } from "@/types";
import { defaultBranchForUser } from "@/lib/branch-selection";
import { goToMarketingHome, goToMarketingLogin } from "@/lib/marketing-site";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const forcedPwReset = useAuthStore((s) => s.user?.mustChangePassword === true);
  const logout = useAuthStore((s) => s.logout);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void useAuthStore.getState().ensureValidSession();
  }, [authReady]);

  useEffect(() => {
    if (!authReady || accessToken) return;
    goToMarketingLogin();
  }, [authReady, accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();
    if (!trimmedCurrent || !trimmedNew) {
      toast.error("Enter your current and new passwords.");
      return;
    }
    const strengthMsg = validateStrongPassword(trimmedNew);
    if (strengthMsg) {
      toast.error(strengthMsg);
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      toast.error("New password confirmation does not match.");
      return;
    }
    if (!accessToken) {
      toast.error("Session expired — please sign in again.");
      goToMarketingLogin();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: trimmedCurrent,
          newPassword: trimmedNew,
        }),
      });
      const payload = (await res.json()) as {
        data: {
          accessToken: string;
          user: User;
          branch: Branch | null;
        } | null;
        error: { message?: string } | null;
      };
      if (!res.ok || payload.error || !payload.data) {
        toast.error(payload.error?.message ?? "Could not update password.");
        return;
      }
      const { accessToken: nextToken, user, branch } = payload.data;
      useAuthStore.setState({
        accessToken: nextToken,
        user,
        currentBranch: defaultBranchForUser(user, branch),
        isAuthenticated: true,
      });
      toast.success("Password updated.");
      router.replace("/dashboard");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!authReady || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex items-center gap-3 justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Prime Detailers</span>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {forcedPwReset ? "Choose a new password" : "Change password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forcedPwReset
              ? "Your administrator assigned a temporary password. Pick your own before continuing."
              : "Update your password."}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{PASSWORD_POLICY_HINT}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <div className="relative">
              <Input
                id="current"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-11 rounded-xl pr-11"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newpw">New password</Label>
            <div className="relative">
              <Input
                id="newpw"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="h-11 rounded-xl pr-11"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 rounded-xl"
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
            {!forcedPwReset ? (
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  logout();
                  goToMarketingLogin();
                }}
              >
                Sign out instead
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
