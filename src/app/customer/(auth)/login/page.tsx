"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, Smartphone, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { useTenantPath, useTenantSlug } from "@/components/tenant/tenant-context";

type PublicBranding = {
  businessName: string;
  businessLogo: string;
  brandPrimary: string;
};

export default function CustomerLoginPage() {
  const router = useRouter();
  const orgSlug = useTenantSlug();
  const tenantHref = useTenantPath();
  const { login, isAuthenticated } = useCustomerAuthStore();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(tenantHref("/customer/dashboard"));
    }
  }, [isAuthenticated, router, tenantHref]);

  useEffect(() => {
    let cancelled = false;
    const path = orgSlug
      ? `/api/public/branding?slug=${encodeURIComponent(orgSlug)}`
      : "/api/public/branding";
    void apiGet<PublicBranding>(path)
      .then((data) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        /* Keep default if API fails */
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(phone, password, orgSlug);
    setLoading(false);

    if (result.ok) {
      toast.success("Login successful");
      router.replace(tenantHref("/customer/dashboard"));
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  const businessName = branding?.businessName?.trim() || "MY DETAIL OS";
  const logoUrl = branding?.businessLogo ? resolveUploadsPublicUrl(branding.businessLogo) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center mb-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={businessName}
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <CardTitle className="text-2xl">{businessName}</CardTitle>
            <CardDescription>Customer Portal</CardDescription>
            <p className="text-xs text-muted-foreground">
              Sign in with your phone number and password
            </p>
            {!orgSlug ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Open your workshop&apos;s customer portal link (/{`{workshop}`}/customer/login) to sign in.
              </p>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Mobile Number
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm text-muted-foreground shrink-0 self-stretch">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  required
                  className="flex-1"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !phone || !password || !orgSlug}
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
