/* @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InspectionEditor } from "./inspection-editor";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { createInspectionSections } from "@/lib/inspection";
import type { InspectionReport } from "@/types/inspection";
import type { Vehicle } from "@/types";

const mocks = vi.hoisted(() => ({
  save: vi.fn(), get: vi.fn(), finalize: vi.fn(), revise: vi.fn(), send: vi.fn(), templates: vi.fn(), saveTemplate: vi.fn(), upload: vi.fn(),
  customerVehicles: vi.fn(), downloadPdf: vi.fn(), downloadPdfFromUrl: vi.fn(),
  pathname: "/inspections/new",
  push: vi.fn(), replace: vi.fn(), success: vi.fn(), error: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), usePathname: () => mocks.pathname }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/tenant/tenant-context", () => ({ useTenantPath: () => (path: string) => `/studio${path}` }));
vi.mock("@/components/shared/page-header", () => ({ PageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock("@/components/shared/customer-search-select", () => ({ CustomerSearchSelect: ({ selectedCustomerId, onSelectCustomer }: { selectedCustomerId: string; onSelectCustomer: (id: string) => void }) => <select aria-label="Customer" value={selectedCustomerId} onChange={(event) => onSelectCustomer(event.target.value)}><option value="">Select customer</option><option value="c1">Amar</option><option value="c2">Ansh</option></select> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (value: string) => void; disabled?: boolean; children: React.ReactNode }) => <select value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));
vi.mock("@/store/auth-store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: "u1", name: "Inspector", role: "ADMIN", branchId: "b1" } }) }));
vi.mock("@/store/customer-store", () => ({ useCustomerStore: (selector: (state: unknown) => unknown) => selector({ customers: [{ id: "c1", name: "Amar", phone: "919999999999", email: "amar@example.com" }, { id: "c2", name: "Ansh", phone: "918888888888", email: "ansh@example.com" }] }) }));
vi.mock("@/store/vehicle-store", () => ({ fetchCustomerVehicles: mocks.customerVehicles, useVehicleStore: (selector: (state: unknown) => unknown) => selector({ vehicles: [{ id: "v1", customerId: "c1", registrationNumber: "KA01AB1234", make: "Honda", model: "City", year: 2023, fuelType: "PETROL" }] }) }));
vi.mock("@/components/vehicles/add-vehicle-dialog", () => ({ AddVehicleDialog: ({ open, lockedCustomerId, onCreated, onOpenChange }: { open: boolean; lockedCustomerId: string; onCreated: (vehicle: unknown) => void; onOpenChange: (open: boolean) => void }) => open ? <div role="dialog" aria-label="Add customer vehicle"><span>Locked customer: {lockedCustomerId}</span><button onClick={() => { onCreated({ id: "new-v1", customerId: lockedCustomerId, registrationNumber: "KA02XY5678", make: "Toyota", model: "Glanza", year: 2025, fuelType: "PETROL", odometer: 250 }); onOpenChange(false); }}>Create linked vehicle</button></div> : null }));
vi.mock("@/store/branch-store", () => ({ useBranchStore: (selector: (state: unknown) => unknown) => selector({ branches: [{ id: "b1", name: "Main", isActive: true }] }) }));
vi.mock("@/store/settings-store", () => ({ useSettingsStore: () => ({ businessName: "Studio", businessAddress: "", businessPhone: "", brandPrimary: "#14B8A6" }) }));
vi.mock("@/lib/branch-scope", () => ({ useBranchScope: () => ({ selectedBranchId: "b1" }) }));
vi.mock("@/hooks/use-scoped-data", () => ({ useScopedJobCards: () => [] }));
vi.mock("@/lib/inspection-api", () => ({ inspectionApi: mocks, inspectionApiError: (error: Error) => error.message }));
vi.mock("@/lib/inspection-pdf", () => ({ downloadInspectionPdf: mocks.downloadPdf, downloadInspectionPdfFromUrl: mocks.downloadPdfFromUrl }));
vi.mock("@/components/job-cards/multi-photo-camera-capture", () => ({ MultiPhotoCameraCapture: () => null, canUseLiveCameraPreview: () => false, requestCameraStream: vi.fn() }));

function finalReport(): InspectionReport {
  const sections = createInspectionSections();
  sections.forEach((section) => section.checkpoints.forEach((checkpoint) => { checkpoint.rating = "GOOD"; }));
  return { id: "i1", reportNumber: "INSP-2026-0001", revision: 1, status: "FINAL", pdfUrl: "/api/inspections/i1/revisions/1/pdf", branchId: "b1", customerId: "c1", customerName: "Amar", customerPhone: "919999999999", customerEmail: "amar@example.com", vehicleId: "v1", vehicleRegistration: "KA01AB1234", vehicleMakeModel: "Honda City", inspectedAt: "2026-10-05", inspectorName: "Inspector", sections, photos: [], notes: "", terms: "", overrideReason: "", createdAt: "2026-10-05", updatedAt: "2026-10-05" };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  mocks.templates.mockResolvedValue({ items: [] });
  mocks.pathname = "/inspections/new";
  mocks.customerVehicles.mockResolvedValue([{ id: "v1", customerId: "c1", registrationNumber: "KA01AB1234", make: "Honda", model: "City", year: 2023, fuelType: "PETROL" }]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("inspection workflow", () => {
  it("downloads a formatted PDF for a finalized report", async () => {
    const report = finalReport();
    mocks.get.mockResolvedValue({ item: report });
    render(<InspectionEditor id="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));
    await waitFor(() => expect(mocks.downloadPdf).toHaveBeenCalledWith(expect.objectContaining(report), expect.objectContaining({ name: "Studio" })));
    expect(mocks.downloadPdfFromUrl).not.toHaveBeenCalled();
  });

  it("starts unchecked and permits rating, adding and removing checkpoints", async () => {
    render(<InspectionEditor />);
    const actionBar = screen.getByRole("button", { name: "Save Draft" }).parentElement!;
    expect(actionBar).toHaveClass("bg-background", "border-t");
    expect(actionBar).not.toHaveClass("sticky", "fixed", "z-50", "backdrop-blur-sm");
    const fuel = screen.getByRole("group", { name: "Fuel system condition" });
    expect(within(fuel).getByRole("button", { name: "Not Checked" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(fuel).getByRole("button", { name: "Good" }));
    expect(within(fuel).getByRole("button", { name: "Good" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getAllByRole("button", { name: "Add Checkpoint" })[0]);
    expect(screen.getByRole("group", { name: "New checkpoint condition" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove New checkpoint" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.queryByRole("group", { name: "New checkpoint condition" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.templates).toHaveBeenCalled());
  });

  it("saves pre-drive condition and relative vehicle pins through the inspection API", async () => {
    mocks.save.mockImplementation(async (payload: InspectionReport) => ({ item: { ...payload, id: "i-condition", reportNumber: "INSP-CONDITION" } }));
    render(<InspectionEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Fair" }));
    fireEvent.click(screen.getByRole("button", { name: "Dent" }));
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 100, top: 100, width: 400, height: 200, right: 500, bottom: 300, x: 100, y: 100, toJSON: () => ({}) });
    fireEvent.click(blueprint, { clientX: 300, clientY: 200 });
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "c1" } });
    await screen.findByRole("option", { name: "KA01AB1234 · Honda City" });
    const vehicle = screen.getAllByRole("combobox").find((select) => select.querySelector('option[value="v1"]'))!;
    fireEvent.change(vehicle, { target: { value: "v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      overallPreDriveCondition: "FAIR",
      vehicleConditions: [expect.objectContaining({ number: 1, type: "DENT", x: 50, y: 50, location: "SUNROOF", area: "Sunroof" })],
    })));
  });

  it("restores the overall condition, pin number, type, and relative position from an inspection", async () => {
    const pin = { id: "saved-pin", number: 3, type: "PAINT_CHIP" as const, x: 62.5, y: 48.2, location: "PASSENGER_GATE" as const, area: "Passenger Gate" };
    mocks.get.mockResolvedValue({ item: { ...finalReport(), overallPreDriveCondition: "POOR", vehicleConditions: [pin] } });
    render(<InspectionEditor id="i1" />);

    expect(await screen.findByRole("heading", { name: "Vehicle Condition (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Poor" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Condition 3: Paint Chip at Passenger Gate" })).toHaveStyle({ left: "62.5%", top: "48.2%" });
  });

  it("confirms clearing pins and keeps the overall condition selected", async () => {
    const pin = { id: "saved-pin", number: 1, type: "SCRATCH" as const, x: 50, y: 54.3, location: "SUNROOF" as const, area: "Sunroof" };
    const draft = { ...finalReport(), status: "DRAFT" as const, overallPreDriveCondition: "FAIR" as const, vehicleConditions: [pin] };
    mocks.get.mockResolvedValue({ item: draft });
    mocks.save.mockImplementation(async (payload: InspectionReport) => ({ item: payload }));
    render(<InspectionEditor id="i1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Clear All" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Clear all vehicle conditions");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("heading", { name: "Vehicle Condition (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fair" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ overallPreDriveCondition: "FAIR", vehicleConditions: [] })));
  });

  it("retains the draft and shows a failed API save instead of fake success", async () => {
    mocks.save.mockRejectedValue(new Error("Inspection service unavailable"));
    render(<InspectionEditor />);
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "c1" } });
    const vehicle = screen.getAllByRole("combobox").find((select) => select.querySelector('option[value="v1"]'))!;
    fireEvent.change(vehicle, { target: { value: "v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await screen.findByRole("alert");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1", vehicleId: "v1", branchId: "b1", status: "DRAFT" }));
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Customer" })).toHaveValue("c1");
  });

  it("does not claim finalization when the API and persisted report still say draft", async () => {
    const draft = { ...finalReport(), status: "DRAFT" as const };
    mocks.get.mockResolvedValue({ item: draft });
    mocks.save.mockResolvedValue({ item: draft });
    mocks.finalize.mockResolvedValue({ item: draft });
    render(<InspectionEditor id="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Finalize Inspection" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("alert");
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ ...draft, overallPreDriveCondition: null, vehicleConditions: [] }));
    expect(mocks.get).toHaveBeenCalledWith("i1");
    expect(mocks.success).not.toHaveBeenCalledWith("Inspection finalized");
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("still reports it as a draft"));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("locks finalized reports and creates an editable revision only after API confirmation", async () => {
    const report = finalReport();
    mocks.get.mockResolvedValue({ item: report });
    mocks.revise.mockResolvedValue({ item: { ...report, status: "DRAFT", revision: 2 } });
    render(<InspectionEditor id="i1" />);
    const revise = await screen.findByRole("button", { name: "New Revision" });
    expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Fuel system condition" })).not.toBeInTheDocument();
    fireEvent.click(revise);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("button", { name: "Save Draft" });
    expect(mocks.revise).toHaveBeenCalledWith(expect.objectContaining({ ...report, overallPreDriveCondition: null, vehicleConditions: [] }));
    expect(mocks.replace).toHaveBeenCalledWith("/studio/inspections/i1");
  });

  it("does not report a failed delivery as sent", async () => {
    mocks.get.mockResolvedValue({ item: finalReport() });
    mocks.send.mockResolvedValue({ item: { status: "FAILED", error: "Provider rejected document" } });
    render(<InspectionEditor id="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Send Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Send PDF" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Provider rejected document"));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reuses the request key when retrying an unknown network outcome", async () => {
    mocks.get.mockResolvedValue({ item: finalReport() });
    mocks.send.mockRejectedValueOnce(new Error("Network interrupted")).mockResolvedValueOnce({ item: { status: "QUEUED" } });
    render(<InspectionEditor id="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Send Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Send PDF" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Network interrupted"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send PDF" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Send PDF" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Report queued for sending"));
    expect(mocks.send.mock.calls[0][3]).toBeTruthy();
    expect(mocks.send.mock.calls[1][3]).toBe(mocks.send.mock.calls[0][3]);
  });

  it("clears checkpoint photo links when loading a replacement template", async () => {
    const report = { ...finalReport(), status: "DRAFT" as const, photos: [{ id: "p1", url: "https://example.com/photo.jpg", caption: "Engine", checkpointId: "checkpoint-0-0" }] };
    mocks.get.mockResolvedValue({ item: report });
    mocks.save.mockResolvedValue({ item: report });
    render(<InspectionEditor id="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load Template" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const saved = mocks.save.mock.calls[0][0] as InspectionReport;
    expect(saved.photos[0].checkpointId).toBeUndefined();
    expect(saved.sections[0].checkpoints[0].rating).toBe("NOT_CHECKED");
  });

  it("selects linked vehicles returned by the customer API even when absent from the directory cache", async () => {
    mocks.customerVehicles.mockResolvedValue([{ id: "v52", customerId: "c1", registrationNumber: "KA03AB5555", make: "Maruti", model: "Baleno", year: 2024, fuelType: "PETROL" }]);
    mocks.save.mockRejectedValue(new Error("Draft API not connected"));
    render(<InspectionEditor />);
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "c1" } });
    await screen.findByRole("option", { name: "KA03AB5555 · Maruti Baleno" });
    expect(mocks.customerVehicles).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("option", { name: "KA01AB1234 · Honda City" })).not.toBeInTheDocument();
    const vehicle = screen.getAllByRole("combobox").find((select) => select.querySelector('option[value="v52"]'))!;
    fireEvent.change(vehicle, { target: { value: "v52" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1", vehicleId: "v52", vehicleRegistration: "KA03AB5555" })));
  });

  it("opens the existing modal locked to a customer without vehicles and selects the created vehicle", async () => {
    mocks.customerVehicles.mockResolvedValue([]);
    render(<InspectionEditor />);
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "c1" } });
    await screen.findByText("No vehicles linked to this customer.");
    fireEvent.click(screen.getByRole("button", { name: "Add vehicle for selected customer" }));
    expect(screen.getByText("Locked customer: c1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create linked vehicle" }));
    expect(screen.queryByRole("dialog", { name: "Add customer vehicle" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "KA02XY5678 · Toyota Glanza" })).toBeInTheDocument();
    const vehicle = screen.getAllByRole("combobox").find((select) => select.querySelector('option[value="new-v1"]'))!;
    expect(vehicle).toHaveValue("new-v1");
    expect(screen.getByLabelText("Odometer (km)")).toHaveValue(250);
    expect(screen.queryByText("No vehicles linked to this customer.")).not.toBeInTheDocument();
  });

  it("does not show a failed fetch as a customer with no vehicles", async () => {
    mocks.customerVehicles.mockRejectedValue(new Error("Vehicle API unavailable"));
    render(<InspectionEditor />);
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "c1" } });
    await screen.findByText("Vehicle API unavailable");
    expect(screen.queryByText("No vehicles linked to this customer.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload customer vehicles" })).toBeInTheDocument();
  });

  it("ignores an older customer's vehicle response after switching customers", async () => {
    let resolveFirst!: (vehicles: Vehicle[]) => void;
    const pending = new Promise<Vehicle[]>((resolve) => { resolveFirst = resolve; });
    mocks.customerVehicles.mockImplementation((customerId: string) => customerId === "c1" ? pending : Promise.resolve([{ id: "v2", customerId: "c2", registrationNumber: "KA04AB2222", make: "Hyundai", model: "i20", year: 2024, fuelType: "PETROL" }]));
    render(<InspectionEditor />);
    const customer = screen.getByRole("combobox", { name: "Customer" });
    fireEvent.change(customer, { target: { value: "c1" } });
    fireEvent.change(customer, { target: { value: "c2" } });
    await screen.findByRole("option", { name: "KA04AB2222 · Hyundai i20" });
    await act(async () => { resolveFirst([{ id: "v1", customerId: "c1", registrationNumber: "KA01AB1234", make: "Honda", model: "City" } as Vehicle]); });
    expect(screen.getByRole("option", { name: "KA04AB2222 · Hyundai i20" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "KA01AB1234 · Honda City" })).not.toBeInTheDocument();
  });
});

describe("inspection scroll controls", () => {
  it("positions Page Up above editor actions on direct and tenant-prefixed routes", () => {
    for (const pathname of ["/inspections/new", "/inspections/i1", "/my-detail-os/inspections/new"]) {
      mocks.pathname = pathname;
      const { unmount } = render(<ScrollToTopButton scrollContainerRef={{ current: document.createElement("main") }} />);
      expect(screen.getByRole("button", { name: "Page up" })).toHaveClass("md:bottom-28");
      unmount();
    }
  });
  it("preserves the normal Page Up position on the inspection list", () => {
    mocks.pathname = "/my-detail-os/inspections";
    render(<ScrollToTopButton scrollContainerRef={{ current: document.createElement("main") }} />);
    expect(screen.getByRole("button", { name: "Page up" })).toHaveClass("md:bottom-6");
  });
});