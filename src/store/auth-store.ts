"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Branch } from "@/types";
import { isAllBranchesScope } from "@/lib/all-branches";
import {
  canOrgWideRole,
  defaultBranchForUser,
} from "@/lib/branch-selection";
import { buildApiUrl } from "@/lib/api-base";
import { useReportFavouritesStore } from "@/store/report-favourites-store";

export type SendLoginOtpResult =
  | {
      ok: true;
      delivery?: "sms" | "log_only";
      hint?: string;
      devDemoCode?: string;
    }
  | { ok: false; message: string };

 export type AuthSessionPayload = {
   accessToken: string;
   user: User;
   branch: Branch | null;
 };

interface AuthState {
  user: User | null;
  currentBranch: Branch | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  /** Updates persisted session after `/api/auth/*` responses that issue a fresh JWT. */
  applyAuthPayload: (data: AuthSessionPayload) => void;
  /** Validates JWT with `/api/auth/me` or clears session */
  ensureValidSession: () => Promise<void>;
  sendLoginOtp: (phone: string) => Promise<SendLoginOtpResult>;
  verifyLoginOtp: (phone: string, code: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setBranch: (branch: Branch) => void;
}

function preserveOrgWideBranch(
  user: User,
  homeBranch: Branch | null,
  persisted: Branch | null
): Branch | null {
  if (!canOrgWideRole(user.role)) return homeBranch;
  if (persisted && !isAllBranchesScope(persisted)) return persisted;
  return defaultBranchForUser(user, homeBranch);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentBranch: null,
      isAuthenticated: false,
      accessToken: null,

      applyAuthPayload: (data) => {
        const homeBranch = data.branch ?? null;
        set({
          accessToken: data.accessToken,
          user: data.user,
          currentBranch: preserveOrgWideBranch(
            data.user,
            homeBranch,
            get().currentBranch
          ),
          isAuthenticated: true,
        });
        void useReportFavouritesStore.getState().hydrateForUser(data.user.id);
      },

      ensureValidSession: async () => {
        const token = get().accessToken;
        if (!token) return;
        try {
          const res = await fetch(buildApiUrl("/api/auth/me"), {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const body = (await res.json()) as {
            data?: { user: User; branch: Branch | null } | null;
            error?: { message?: string } | null;
          };
          if (!res.ok || body.error || !body.data) {
            get().logout();
            return;
          }
          const { user, branch } = body.data;
          const homeBranch = branch ?? null;
          set({
            user,
            currentBranch: preserveOrgWideBranch(
              user,
              homeBranch,
              get().currentBranch
            ),
            isAuthenticated: true,
          });
          void useReportFavouritesStore.getState().hydrateForUser(user.id);
        } catch {
          get().logout();
        }
      },

      sendLoginOtp: async (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) {
          return { ok: false as const, message: "Enter a valid 10-digit mobile number" };
        }
        try {
          const res = await fetch(buildApiUrl("/api/auth/otp/send"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: digits }),
          });
          const body = (await res.json()) as {
            data?: {
              ok?: boolean;
              delivery?: "sms" | "log_only";
              hint?: string;
              devDemoCode?: string;
            } | null;
            error?: { message?: string } | null;
          };
          if (!res.ok || body.error) {
            return {
              ok: false as const,
              message: body.error?.message ?? "Could not send OTP. Try again.",
            };
          }
          const d = body.data;
          return {
            ok: true as const,
            delivery: d?.delivery,
            hint: typeof d?.hint === "string" ? d.hint : undefined,
            devDemoCode: typeof d?.devDemoCode === "string" ? d.devDemoCode : undefined,
          };
        } catch {
          return {
            ok: false as const,
            message: "Network error — is the API running?",
          };
        }
      },

      verifyLoginOtp: async (phone: string, code: string) => {
        const digits = phone.replace(/\D/g, "");
        const trimmed = code.replace(/\D/g, "");
        if (digits.length !== 10 || trimmed.length < 4) return false;
        try {
          const res = await fetch(buildApiUrl("/api/auth/otp/verify"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: digits, code: trimmed }),
          });
          const body = (await res.json()) as {
            data: {
              accessToken: string;
              user: User;
              branch: Branch | null;
            } | null;
            error: { message?: string } | null;
          };
          if (!res.ok || body.error || !body.data) {
            return false;
          }
          const { accessToken, user, branch } = body.data;
          const homeBranch = branch ?? null;
          set({
            accessToken,
            user,
            currentBranch: defaultBranchForUser(user, homeBranch),
            isAuthenticated: true,
          });
          return true;
        } catch {
          return false;
        }
      },

      login: async (email: string, password: string) => {
        const trimmed = email.trim();
        if (!trimmed || !password) return false;
        try {
          const res = await fetch(buildApiUrl("/api/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed, password }),
          });
          const body = (await res.json()) as {
            data: {
              accessToken: string;
              user: User;
              branch: Branch | null;
            } | null;
            error: { message?: string } | null;
          };
          if (!res.ok || body.error || !body.data) {
            return false;
          }
          const { accessToken, user, branch } = body.data;
          const homeBranch = branch ?? null;
          set({
            accessToken,
            user,
            currentBranch: defaultBranchForUser(user, homeBranch),
            isAuthenticated: true,
          });
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        const token = get().accessToken;
        if (token) {
          void fetch(buildApiUrl("/api/auth/logout"), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        useReportFavouritesStore.getState().clear();
        set({
          user: null,
          currentBranch: null,
          isAuthenticated: false,
          accessToken: null,
        });
      },

      setBranch: (branch: Branch) => {
        set({ currentBranch: branch });
      },
    }),
    {
      name: "prime-detailers-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        currentBranch: state.currentBranch,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    }
  )
);
