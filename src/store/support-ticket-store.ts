"use client";

import { create } from "zustand";
import type { SupportTicket, SupportTicketAttachment, SupportTicketMessage } from "@/types";
import {
  deleteCollectionDocument,
  getCollectionDocument,
  putCollectionDocument,
  postCollectionSnapshot,
} from "@/lib/collection-sync";

interface SupportTicketStore {
  tickets: SupportTicket[];
  setTickets: (items: SupportTicket[]) => void;
  addTicket: (ticket: SupportTicket) => Promise<void>;
  updateTicket: (id: string, patch: Partial<SupportTicket>) => Promise<void>;
  appendMessage: (
    id: string,
    message: SupportTicketMessage,
    newAttachments?: SupportTicketAttachment[]
  ) => Promise<void>;
  removeTicket: (id: string) => Promise<void>;
  /** Pull latest ticket from API before local merge (avoids clobbering platform replies). */
  refreshTicket: (id: string) => Promise<SupportTicket | null>;
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

  refreshTicket: async (id) => {
    try {
      const latest = await getCollectionDocument<SupportTicket>("supportTickets", id);
      if (!latest?.id) return null;
      set((s) => ({
        tickets: s.tickets.some((t) => t.id === id)
          ? s.tickets.map((t) => (t.id === id ? latest : t))
          : [latest, ...s.tickets],
      }));
      return latest;
    } catch {
      return get().tickets.find((t) => t.id === id) ?? null;
    }
  },

  appendMessage: async (id, message, newAttachments) => {
    let prev = get().tickets.find((t) => t.id === id) ?? null;
    try {
      const latest = await getCollectionDocument<SupportTicket>("supportTickets", id);
      if (latest?.id) prev = latest;
    } catch {
      /* use local */
    }
    if (!prev) return;

    const already = prev.messages.some((m) => m.id === message.id);
    const messages = already ? prev.messages : [...prev.messages, message];
    const attachments = newAttachments?.length
      ? [...(prev.attachments ?? []), ...newAttachments]
      : prev.attachments ?? [];
    const next: SupportTicket = {
      ...prev,
      messages,
      attachments,
      updatedAt: new Date().toISOString(),
      status:
        prev.status === "RESOLVED" || prev.status === "CLOSED" || prev.status === "WAITING_ON_CUSTOMER"
          ? "OPEN"
          : prev.status,
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
