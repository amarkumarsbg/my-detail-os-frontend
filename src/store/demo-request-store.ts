"use client";

import { create } from "zustand";
import type { DemoRequest } from "@/types";
import { putCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";

interface DemoRequestStore {
  demoRequests: DemoRequest[];
  setDemoRequests: (items: DemoRequest[]) => void;
  addDemoRequest: (item: DemoRequest) => Promise<void>;
}

export const useDemoRequestStore = create<DemoRequestStore>((set) => ({
  demoRequests: [],

  setDemoRequests: (items) => set({ demoRequests: items }),

  addDemoRequest: async (item) => {
    await putCollectionDocument("demoRequests", item.id, item);
    set((s) => ({
      demoRequests: [item, ...s.demoRequests.filter((x) => x.id !== item.id)],
    }));
  },
}));

export async function syncDemoRequestsSnapshot(items: DemoRequest[]): Promise<void> {
  await postCollectionSnapshot("demoRequests", items);
}
