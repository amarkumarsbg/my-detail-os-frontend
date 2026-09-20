"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildApiUrl } from "@/lib/api-base";
import { PASSWORD_POLICY_HINT, validateStrongPassword } from "@/lib/password-policy";
import {
  Wrench,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type ResetLinkState = "absent" | "checking" | "active" | "inactive" | "error";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<ResetLinkState>(() =>
    token ? "checking" : "absent"
  );

  useEffect(() => {
    if (!token) {
      setLinkState("absent");
      return;
    }
    let cancelled = false;
    setLinkState("checking");
    void (async () => {
      try {
        const url = `${buildApiUrl("/api/auth/reset-password/status")}?token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        const body = (await res.json()) as {
          data?: { pending?: boolean } | null;
          error?: { message?: string } | null;
        };
        if (cancelled) return;
        if (!res.ok || body.error) {
          setLinkState("error");
          return;
        }
        setLinkState(body.data?.pending === true ? "active" : "inactive");
      } catch {
        if (!cancelled) setLinkState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing a reset token. Open the link from your email again.");
      return;
    }
    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json()) as {
        data?: { ok?: boolean; message?: string } | null;
        error?: { message?: string } | null;
      };
      if (!res.ok || body.error) {
        setError(body.error?.message ?? "Could not reset password. Try requesting a new link.");
        setLoading(false);
        return;
      }
      toast.success(body.data?.message ?? "Password updated.");
      goToMarketingLogin();
    } catch {
      setError("Network error — is the API running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        </div>
        <div className="absolute inset-0 opacity-[0.04] bg-grid-light" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Prime Detailers</span>
          </div>
          <div className="max-w-lg space-y-4">
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Set a new password
              <br />
              <span className="text-emerald-200">and get back to work.</span>
            </h2>
            <p className="text-emerald-100/80 text-lg leading-relaxed">
              Choose something strong—you will use this to sign in from now on.
            </p>
          </div>
          <p className="text-emerald-200/50 text-sm">
            &copy; {new Date().getFullYear()} Prime Detailers. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Prime Detailers</span>
          </div>

          <Link
            href={marketingLoginUrl()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to sign in</span>
          </Link>

          <div className="space-y-2 mb-8">
            <div
              className={`flex items-center justify-center w-14 h-14 rounded-2xl mb-6 ${
                linkState === "inactive"
                  ? "bg-amber-100 dark:bg-amber-900/35"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}
            >
              {linkState === "inactive" ? (
                <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              ) : (
                <KeyRound className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {linkState === "inactive"
                ? "Link no longer valid"
                : linkState === "checking"
                  ? "Checking link"
                  : "New password"}
            </h1>
            <p className="text-muted-foreground">
              {linkState === "inactive"
                ? "This reset link was already used or has expired."
                : linkState === "checking"
                  ? "Hang tight — validating your reset link."
                  : "Enter your new password twice to confirm."}
            </p>
          </div>

          {!token ? (
            <p className="text-sm text-destructive mb-6" role="alert">
              This page needs a valid link from your reset email. Request a new one from Forgot
              password.
            </p>
          ) : null}

          {token && linkState === "checking" ? (
            <div className="flex flex-col items-center gap-4 py-10 mb-4">
              <span
                className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">Checking your reset link…</p>
            </div>
          ) : null}

          {token && linkState === "inactive" ? (
            <div className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/35 p-5 space-y-4 mb-6">
              <p className="text-sm text-foreground leading-relaxed">
                Password reset links work once. If you still need to change your password, request a
                new email.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="rounded-xl h-11" asChild>
                  <Link href={marketingForgotPasswordUrl()}>Forgot password</Link>
                </Button>
                <Button variant="outline" className="rounded-xl h-11" asChild>
                  <Link href={marketingLoginUrl()}>Back to sign in</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {token && linkState === "error" ? (
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/25 px-3 py-2">
              Couldn&apos;t verify this link right now. You can still try saving a new password
              below, or request a fresh link.
            </p>
          ) : null}

          {token && (linkState === "active" || linkState === "error") ? (
            <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">
                New password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 pr-11 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 pr-11 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Save new password
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
            </form>
          ) : null}

          <p className="text-center text-xs text-muted-foreground/60 mt-10 lg:hidden">
            Prime Detailers v1.0 &middot; Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
