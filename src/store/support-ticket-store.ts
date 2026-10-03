"use client";

import { create } from "zustand";
import type { SupportTicket, SupportTicketMessage } from "@/types";
import { deleteCollectionDocument, putCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";

interface SupportTicketStore {
  tickets: SupportTicket[];
  setTickets: (items: SupportTicket[]) => void;
  addTicket: (ticket: SupportTicket) => Promise<void>;
  updateTicket: (id: string, patch: Partial<SupportTicket>) => Promise<void>;
  appendMessage: (id: string, message: SupportTicketMessage) => Promise<void>;
  removeTicket: (id: string) => Promise<void>;
}

export const useSupportTicketStore = create<SupportTicketStore>((set, get) => ({
  tickets: [],

  setTickets: (items) => set({ tickets: items }),

  addTicket: async (ticket) => {
    await putCollectionDocument("supportTickets", ticket.id, ticket);
    set((s) => ({ tickets: [ticket, ...s.tickets.filter((x) => x.id !== ticket.id)] }));
  },

  updateTicket: async (id, patch) => {
    const prev = get().tickets.find((t) => t.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    await putCollectionDocument("supportTickets", id, next);
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? next : t)) }));
  },

  appendMessage: async (id, message) => {
    const prev = get().tickets.find((t) => t.id === id);
    if (!prev) return;
    const next: SupportTicket = {
      ...prev,
      messages: [...prev.messages, message],
      updatedAt: new Date().toISOString(),
      status: prev.status === "RESOLVED" || prev.status === "CLOSED" ? "OPEN" : prev.status,
    };
    await putCollectionDocument("supportTickets", id, next);
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? next : t)) }));
  },

  removeTicket: async (id) => {
    await deleteCollectionDocument("supportTickets", id);
    set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) }));
  },
}));

export async function syncSupportTicketsSnapshot(tickets: SupportTicket[]): Promise<void> {
  await postCollectionSnapshot("supportTickets", tickets);
}
