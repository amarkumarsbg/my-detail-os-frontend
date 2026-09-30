"use client";

import { create } from "zustand";
import { bootstrapAppData } from "@/lib/bootstrap-app-data";

interface AppBootstrapState {
  ready: boolean;
  error: string | null;
  /** True while a bootstrap fetch is in flight (initial or refresh). */
  refreshing: boolean;
  /** Wall-clock ms when shell last became ready (0 if never). Used to skip early visibility refresh. */
  readyAtMs: number;
  /** Initial load with retries. No-op if already ready unless `{ force: true }`. */
  run: (options?: { force?: boolean }) => Promise<void>;
  /** Revalidate shell data; joins in-flight work; keeps cache on failure if already ready. */
  refresh: () => Promise<void>;
  reset: () => void;
}

const RETRIES = 4;
/** Backoff between bootstrap failures (cold Render wake). Kept short so sleeps don't dominate. */
const RETRY_DELAYS_MS = [500, 1500, 3000, 5000] as const;

/** Shared single-flight promise for run + refresh. */
let inflight: Promise<void> | null = null;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const useAppBootstrapStore = create<AppBootstrapState>((set, get) => ({
  ready: false,
  error: null,
  refreshing: false,
  readyAtMs: 0,

  reset: () => {
    inflight = null;
    set({ ready: false, error: null, refreshing: false, readyAtMs: 0 });
  },

  refresh: async () => {
    if (inflight) return inflight;

    let work!: Promise<void>;
    work = (async () => {
      set({ refreshing: true });
      try {
        await bootstrapAppData();
        set({ ready: true, error: null, readyAtMs: Date.now() });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not refresh data from API";
        if (!get().ready) {
          set({ error: msg, ready: false });
        } else {
          console.warn("[bootstrap] Background refresh failed (keeping cached data):", msg);
        }
      } finally {
        set({ refreshing: false });
        if (inflight === work) inflight = null;
      }
    })();

    inflight = work;
    return work;
  },

  run: async (options) => {
    const force = options?.force === true;
    if (get().ready && !force) return;
    if (inflight) return inflight;

    let work!: Promise<void>;
    work = (async () => {
      set({ error: null, refreshing: true });
      let lastError: unknown;
      try {
        for (let attempt = 0; attempt < RETRIES; attempt++) {
          try {
            await bootstrapAppData();
            set({ ready: true, error: null, readyAtMs: Date.now(), refreshing: false });
            return;
          } catch (e) {
            lastError = e;
            if (attempt < RETRIES - 1) {
              await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
            }
          }
        }
        set({
          error: lastError instanceof Error ? lastError.message : "Could not load data from API",
          ready: false,
          refreshing: false,
        });
      } finally {
        if (inflight === work) inflight = null;
        if (get().refreshing) set({ refreshing: false });
      }
    })();

    inflight = work;
    return work;
  },
}));

/** @internal test helper — clear module inflight between tests */
export function __resetBootstrapInflightForTests() {
  inflight = null;
}
