"use client";

import { create } from "zustand";
import type { OfferBroadcast } from "@/types";
import { deleteCollectionDocument, putCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";

interface OfferStore {
  offers: OfferBroadcast[];
  setOffers: (items: OfferBroadcast[]) => void;
  addOffer: (offer: OfferBroadcast) => Promise<void>;
  updateOffer: (id: string, patch: Partial<OfferBroadcast>) => Promise<void>;
  removeOffer: (id: string) => Promise<void>;
}

export const useOfferStore = create<OfferStore>((set, get) => ({
  offers: [],

  setOffers: (items) => set({ offers: items }),

  addOffer: async (offer) => {
    await putCollectionDocument("offers", offer.id, offer);
    set((s) => ({ offers: [offer, ...s.offers.filter((x) => x.id !== offer.id)] }));
  },

  updateOffer: async (id, patch) => {
    const prev = get().offers.find((o) => o.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    await putCollectionDocument("offers", id, next);
    set((s) => ({ offers: s.offers.map((o) => (o.id === id ? next : o)) }));
  },

  removeOffer: async (id) => {
    await deleteCollectionDocument("offers", id);
    set((s) => ({ offers: s.offers.filter((o) => o.id !== id) }));
  },
}));

export async function syncOffersSnapshot(offers: OfferBroadcast[]): Promise<void> {
  await postCollectionSnapshot("offers", offers);
}
