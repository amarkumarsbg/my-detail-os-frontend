export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  referralCode: string;
  referredBy?: string;
  totalVisits: number;
  rewardPoints: number;
  walletBalance: number;
  lastVisitDate?: string;
  isInactive?: boolean;
  emailVerified?: boolean;  /** Profile photo stored as a data URL (same format as User.avatar). */
  avatar?: string | null;  
  notes?: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  source: "REFERRAL_REWARD" | "LOYALTY_POINTS" | "ADMIN_CREDIT" | "INVOICE_PAYMENT" | "REFUND";
  referenceId?: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastVisitDate: string;
  daysSinceLastVisit: number;
  assignedTo?: string;
  assignedToName?: string;
  status: "PENDING" | "CALLED" | "SCHEDULED" | "NOT_INTERESTED" | "REENGAGED";
  callNotes?: string;
  nextCallbackDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Workshop promotional offer / WhatsApp broadcast (JSON collection `offers`). */
export interface OfferBroadcast {
  id: string;
  name: string;
  code: string;
  validTill: string;
  maxDiscount: number;
  details: string;
  /** Editable WhatsApp body; may include `{{name}}` for per-recipient first name. */
  customMessage?: string;
  selectedCustomerIds: string[];
  status: "DRAFT" | "SENT";
  sentAt?: string;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SupportTicketCategory = "BUG" | "FEATURE";
export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export interface SupportTicketAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** data URL for images/audio/docs (kept small client-side). */
  dataUrl: string;
  kind: "file" | "voice";
}

export interface SupportTicketMessage {
  id: string;
  author: "WORKSHOP" | "SUPPORT";
  authorName: string;
  body: string;
  createdAt: string;
  attachmentIds?: string[];
}

/** Workshop → platform help tickets (JSON collection `supportTickets`). */
export interface SupportTicket {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  description: string;
  status: SupportTicketStatus;
  createdByUserId?: string;
  createdByName: string;
  /** Denormalized for platform admin inbox (row still scoped by AppJsonRow.organizationId). */
  organizationId?: string;
  organizationName?: string;
  attachments: SupportTicketAttachment[];
  messages: SupportTicketMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Live product demo booking (JSON collection `demoRequests`). */
export interface DemoRequest {
  id: string;
  fullName: string;
  mobile: string;
  workshopName: string;
  city: string;
  interests: string;
  slotDate: string;
  slotLabel: string;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  createdByUserId?: string;
  createdAt: string;
}
