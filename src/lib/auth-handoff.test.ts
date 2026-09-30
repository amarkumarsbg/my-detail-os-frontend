import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  consumeFreshAuthHandoff,
  markAuthHandoffFresh,
} from "@/lib/auth-handoff";

const store = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => {
    store.clear();
  },
});

describe("auth-handoff", () => {
  beforeEach(() => {
    store.clear();
  });

  it("consumes a fresh handoff once", () => {
    markAuthHandoffFresh();
    expect(consumeFreshAuthHandoff()).toBe(true);
    expect(consumeFreshAuthHandoff()).toBe(false);
  });

  it("rejects missing handoff", () => {
    expect(consumeFreshAuthHandoff()).toBe(false);
  });
});
