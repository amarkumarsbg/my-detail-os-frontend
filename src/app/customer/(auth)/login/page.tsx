"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { useTenantPath, useTenantSlug } from "@/components/tenant/tenant-context";
import { marketingHomeUrl } from "@/lib/marketing-site";
import { cn } from "@/lib/utils";

type PublicBranding = {
  businessName: string;
  businessLogo: string;
  brandPrimary: string;
};

function FloatingField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  disabled,
  autoComplete,
  trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative w-full mt-2 mb-4">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || " "}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={cn(
          "peer block w-full rounded-md border-2 border-slate-300 bg-transparent px-3 py-3 text-slate-900 placeholder:text-transparent focus:border-teal-600 focus:placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          trailing && "pr-11"
        )}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-2 top-0 -translate-y-1/2 bg-white px-1 text-sm text-slate-500 transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-focus:top-0 peer-focus:text-sm peer-focus:text-teal-600"
      >
        {label}
      </label>
      {trailing ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>
      ) : null}
    </div>
  );
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const orgSlug = useTenantSlug();
  const tenantHref = useTenantPath();
  const { login, isAuthenticated } = useCustomerAuthStore();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    if (!orgSlug) {
      window.location.replace(marketingHomeUrl());
    }
  }, [orgSlug]);

  useEffect(() => {
    if (!orgSlug) return;
    if (isAuthenticated) {
      router.replace(tenantHref("/customer/dashboard"));
    }
  }, [isAuthenticated, router, tenantHref, orgSlug]);

  useEffect(() => {
    if (!orgSlug) return;
    let cancelled = false;
    void apiGet<PublicBranding>(
      `/api/public/branding?slug=${encodeURIComponent(orgSlug)}`
    )
      .then((data) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        /* Keep defaults if API fails */
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  if (!orgSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-10 w-10 rounded-full border-2 border-teal-600/30 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
  }

  const businessName = branding?.businessName?.trim() || "Customer Portal";
  const logoUrl = branding?.businessLogo
    ? resolveUploadsPublicUrl(branding.businessLogo)
    : "/my-detail-os-mark.png";

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10">
        <div className="text-center mb-8 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            width={56}
            height={56}
            className="mb-4 size-14 rounded-2xl object-cover shadow-sm"
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {businessName}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Customer portal — sign in with your phone and password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-left">
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium text-slate-600"
            >
              Mobile Number
            </label>
            <div className="flex gap-2">
              <div className="flex h-[50px] shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                +91
              </div>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                maxLength={10}
                disabled={loading}
                className="block w-full rounded-md border-2 border-slate-300 bg-transparent px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="text-left">
            <FloatingField
              id="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              required
              disabled={loading}
              autoComplete="current-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-slate-400 hover:text-slate-700"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading || phone.length < 10 || !password}
            className="w-full h-11 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
