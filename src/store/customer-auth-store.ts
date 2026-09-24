"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CustomerUser } from "@/types";
import { buildApiUrl } from "@/lib/api-base";

export type CustomerAuthSessionPayload = {
  accessToken: string;
  user: CustomerUser;
};

interface CustomerAuthState {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  accessToken: string | null;

  /** Login with phone and password (tenant-scoped via organizationSlug). */
  login: (
    phone: string,
    password: string,
    organizationSlug?: string | null
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  
  /** Verify and apply JWT session */
  applyAuthPayload: (data: CustomerAuthSessionPayload) => void;
  
  /** Check if session is still valid */
  ensureValidSession: () => Promise<void>;
  
  /** Logout and clear session */
  logout: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,

      applyAuthPayload: (data) => {
        set({
          accessToken: data.accessToken,
          user: data.user,
          isAuthenticated: true,
        });
      },

      login: async (phone: string, password: string, organizationSlug?: string | null) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) {
          return { ok: false, message: "Enter a valid 10-digit mobile number" };
        }
        if (!password) {
          return { ok: false, message: "Enter your password" };
        }
        const slug = typeof organizationSlug === "string" ? organizationSlug.trim() : "";
        if (!slug) {
          return {
            ok: false,
            message: "Open your workshop customer portal link to sign in.",
          };
        }

        try {
          const res = await fetch(buildApiUrl("/api/auth/customer/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: digits, password, organizationSlug: slug }),
          });

          const body = (await res.json()) as {
            data?: { accessToken: string; user: Omit<CustomerUser, "role" | "customerId"> } | null;
            error?: { message?: string } | null;
          };

          if (!res.ok || body.error || !body.data) {
            return {
              ok: false,
              message: body.error?.message ?? "Invalid phone or password",
            };
          }

          const { accessToken, user: apiUser } = body.data;
          const user: CustomerUser = {
            ...apiUser,
            customerId: apiUser.id,
            role: "CUSTOMER",
          };
          set({
            accessToken,
            user,
            isAuthenticated: true,
          });

          return { ok: true };
        } catch {
          return {
            ok: false,
            message: "Network error — is the API running?",
          };
        }
      },

      ensureValidSession: async () => {
        const token = get().accessToken;
        if (!token) return;

        try {
          const res = await fetch(buildApiUrl("/api/auth/customer/me"), {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });

          const body = (await res.json()) as {
            data?: { user: Omit<CustomerUser, "role" | "customerId"> } | null;
            error?: { message?: string } | null;
          };

          if (!res.ok || body.error || !body.data) {
            // Only logout on 401 Unauthorized — not on 404/500 (endpoint may not be implemented yet)
            if (res.status === 401) {
              get().logout();
            }
            return;
          }

          const apiUser = body.data.user;
          const user: CustomerUser = {
            ...apiUser,
            customerId: apiUser.id,
            role: "CUSTOMER",
          };
          set({
            user,
            isAuthenticated: true,
          });
        } catch {
          // Network error — don't logout, user may just be offline
        }
      },

      logout: () => {
        // Fire logout API (stateless - don't await, just best-effort)
        const token = get().accessToken;
        if (token) {
          void fetch(buildApiUrl("/api/auth/customer/logout"), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "customer-auth",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
