/* @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InspectionList } from "./inspection-list";
import { createInspectionSections } from "@/lib/inspection";

const mocks = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn(), send: vi.fn(), resend: vi.fn(), delete: vi.fn(), revise: vi.fn(), get: vi.fn(), push: vi.fn(), pdf: vi.fn(), historyPdf: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/shared/page-header", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock("@/components/tenant/tenant-context", () => ({ useTenantPath: () => (path: string) => `/studio${path}` }));
vi.mock("@/store/auth-store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: "u1", name: "Admin", role: "ADMIN", branchId: "b1" } }) }));
vi.mock("@/store/settings-store", () => ({ useSettingsStore: () => ({ businessName: "Studio", businessAddress: "", businessPhone: "", brandPrimary: "#14B8A6" }) }));
vi.mock("@/lib/branch-scope", () => ({ useBranchScope: () => ({ selectedBranchId: "b1" }) }));
vi.mock("@/lib/inspection-api", () => ({ inspectionApi: mocks, inspectionApiError: (error: Error) => error.message }));
vi.mock("@/lib/inspection-pdf", () => ({ downloadInspectionPdf: mocks.pdf, downloadInspectionPdfFromUrl: mocks.historyPdf }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/ui/tabs", () => {
  let selectTab: ((value: string) => void) | undefined;
  return {
    Tabs: ({ children, onValueChange }: React.PropsWithChildren<{ onValueChange: (value: string) => void }>) => { selectTab = onValueChange; return <div>{children}</div>; },
    TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    TabsTrigger: ({ children, value }: React.PropsWithChildren<{ value: string }>) => <button onClick={() => selectTab?.(value)}>{children}</button>,
  };
});
vi.mock("@/components/ui/select", () => ({ Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>, SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>, SelectItem: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, asChild, ...props }: React.PropsWithChildren<{ onSelect?: () => void; asChild?: boolean; className?: string; disabled?: boolean; title?: string }>) => asChild ? <div>{children}</div> : <button onClick={onSelect} {...props}>{children}</button>,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

function report(status: "DRAFT" | "FINAL") {
  const sections = createInspectionSections();
  if (status === "FINAL") sections.forEach((section) => section.checkpoints.forEach((checkpoint) => { checkpoint.rating = "GOOD"; }));
  return { id: `i-${status}`, reportNumber: `INSP-${status}`, revision: 1, status, pdfUrl: status === "FINAL" ? `/api/inspections/i-${status}/pdf` : undefined, branchId: "b1", customerId: "c1", customerName: "Amar Kumar", customerPhone: "919999999999", customerEmail: "amar@example.com", vehicleId: "v1", vehicleRegistration: "KA01AB1234", vehicleMakeModel: "Honda City", inspectedAt: "2026-10-06", inspectorName: "Amar Kumar", sections, photos: [], notes: "", terms: "", overrideReason: "", createdAt: "2026-10-06", updatedAt: "2026-10-06", whatsAppStatus: status === "FINAL" ? "DELIVERED" : "NOT_SENT" } as const;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  mocks.list.mockImplementation(async () => ({ items: [report("DRAFT"), report("FINAL")], total: 2, totalPages: 1 }));
  mocks.history.mockResolvedValue({ items: [], total: 0, totalPages: 1 });
  mocks.resend.mockResolvedValue({ item: { status: "QUEUED" } });
  mocks.historyPdf.mockResolvedValue(undefined);
  mocks.delete.mockResolvedValue({ deleted: true });
  mocks.revise.mockResolvedValue({ item: { ...report("DRAFT"), id: "i-revision", revision: 2 } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("inspection row actions", () => {
  it("shows view, edit and PDF on drafts but only sends finalized reports", async () => {
    render(<InspectionList />);
    expect(await screen.findByRole("link", { name: "INSP-DRAFT" })).toHaveAttribute("href", "/studio/inspections/i-DRAFT");
    expect(screen.getAllByRole("button", { name: "Edit Checklist" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Report ID", "Customer", "Vehicle", "Date", "Overall Rating", "Inspected By", "WhatsApp Status", "Actions"]);
    expect(screen.getAllByText("Amar Kumar").length).toBeGreaterThan(0);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Not sent")).toBeInTheDocument();
    expect(screen.getByText("Good")).toHaveClass("text-green-700");
    expect(screen.getByText("Not Checked")).toHaveClass("text-muted-foreground");
    expect(screen.getAllByRole("button", { name: "Download PDF" })).toHaveLength(2);
    const sendActions = screen.getAllByRole("button", { name: "Send on WhatsApp" });
    expect(sendActions).toHaveLength(2);
    expect(sendActions[0]).toBeDisabled();
    expect(sendActions[1]).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Edit Checklist" })).toHaveLength(2);
  });

  it("downloads the selected report PDF", async () => {
    render(<InspectionList />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Download PDF" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Download PDF" })[0]);
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ id: "i-DRAFT" }), expect.objectContaining({ name: "Studio" })));
    fireEvent.click(screen.getAllByRole("button", { name: "Download PDF" })[1]);
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ id: "i-FINAL", status: "FINAL" }), expect.objectContaining({ name: "Studio" })));
  });

  it("confirms the WhatsApp recipient and sends the selected finalized revision", async () => {
    mocks.send.mockResolvedValue({ item: { status: "QUEUED" } });
    mocks.get.mockResolvedValue({ item: { ...report("FINAL"), revision: 7 } });
    render(<InspectionList />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Send on WhatsApp" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Send on WhatsApp" })[1]);
    expect(screen.getByLabelText("WhatsApp number")).toHaveValue("919999999999");
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("i-FINAL"));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ id: "i-FINAL", revision: 7 }), "WHATSAPP", "919999999999", expect.any(String)));
    expect(mocks.success).toHaveBeenCalledWith("Report queued for WhatsApp");
  });

  it("does not send when the detail API omits the finalized revision", async () => {
    mocks.get.mockResolvedValue({ item: { ...report("FINAL"), revision: undefined } });
    render(<InspectionList />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Send on WhatsApp" }))[1]);
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("revision could not be verified")));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("confirms report deletion, calls the backend, and refreshes the list", async () => {
    render(<InspectionList />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Delete Report" }))[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("INSP-DRAFT will be removed");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("i-DRAFT"));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.success).toHaveBeenCalledWith("Inspection report deleted");
  });

  it("preserves the report and confirmation on a delete API error", async () => {
    mocks.delete.mockRejectedValue(new Error("Delete is not available yet"));
    render(<InspectionList />);
    const deleteItem = (await screen.findAllByRole("button", { name: "Delete Report" }))[0];
    fireEvent.click(deleteItem);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Delete is not available yet"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "INSP-DRAFT" })).toBeInTheDocument();
  });

  it("creates a new revision when Edit Checklist is selected for a finalized report", async () => {
    render(<InspectionList />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Edit Checklist" }))[1]);
    expect(screen.getByRole("dialog")).toHaveTextContent("will remain unchanged");
    fireEvent.click(screen.getByRole("button", { name: "Create Revision" }));
    await waitFor(() => expect(mocks.revise).toHaveBeenCalledWith(report("FINAL")));
    expect(mocks.push).toHaveBeenCalledWith("/studio/inspections/i-revision");
  });

  it("shows send history columns and resends the logged report revision", async () => {
    const log = { id: "s1", inspectionId: "i-FINAL", pdfUrl: "/api/inspections/i-FINAL/sends/s1/pdf", reportNumber: "INSP-FINAL", reportRevision: 1, customerName: "Amar Kumar", vehicleRegistration: "KA01AB1234", branchId: "b1", channel: "WHATSAPP", recipient: "919999999999", status: "SENT", sentAt: "2026-10-06T02:00:00.000Z", sentBy: "Amar Kumar" } as const;
    mocks.history.mockResolvedValue({ items: [log], total: 1, totalPages: 1 });
    render(<InspectionList />);
    fireEvent.click(screen.getByRole("button", { name: "Send History" }));
    expect(await screen.findByRole("link", { name: "INSP-FINAL" })).toHaveAttribute("href", "/studio/inspections/i-FINAL");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Report ID", "Customer", "Vehicle", "Channel", "Sent At", "Sent By", "Status", "Actions"]);
    expect(screen.getByRole("button", { name: "Resend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF for INSP-FINAL" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View report INSP-FINAL" })).toHaveAttribute("href", "/studio/inspections/i-FINAL");
    mocks.get.mockResolvedValue({ item: report("FINAL") });
    fireEvent.click(screen.getByRole("button", { name: "Download PDF for INSP-FINAL" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("i-FINAL"));
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ id: "i-FINAL", revision: 1 }), expect.objectContaining({ name: "Studio" })));
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(screen.getByRole("heading", { name: "Resend Inspection Report" })).toBeInTheDocument();
    expect(screen.getByText("Report ID: INSP-FINAL")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer WhatsApp Number *")).toHaveValue("919999999999");
    fireEvent.change(screen.getByLabelText("Customer WhatsApp Number *"), { target: { value: "919876543210" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend Report" }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith({ ...log, recipient: "919876543210" }, expect.any(String)));
  });

  it("keeps the exact backend PDF when the history entry is an older revision", async () => {
    const log = { id: "s2", inspectionId: "i-FINAL", pdfUrl: "/api/inspections/i-FINAL/sends/s2/pdf", reportNumber: "INSP-FINAL", reportRevision: 1, customerName: "Amar Kumar", vehicleRegistration: "KA01AB1234", branchId: "b1", channel: "WHATSAPP", recipient: "919999999999", status: "SENT", sentAt: "2026-10-06T02:00:00.000Z", sentBy: "Admin" } as const;
    mocks.history.mockResolvedValue({ items: [log], total: 1, totalPages: 1 });
    mocks.get.mockResolvedValue({ item: { ...report("FINAL"), revision: 2 } });
    render(<InspectionList />);
    fireEvent.click(screen.getByRole("button", { name: "Send History" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF for INSP-FINAL" }));
    await waitFor(() => expect(mocks.historyPdf).toHaveBeenCalledWith(log.pdfUrl, "INSP-FINAL", 1));
  });
});