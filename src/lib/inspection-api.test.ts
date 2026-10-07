import { describe, expect, it, vi } from "vitest";
import { inspectionApi } from "./inspection-api";
import type { InspectionReport } from "@/types/inspection";

const mocks = vi.hoisted(() => ({ apiDelete: vi.fn(), apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiPostForm: vi.fn() }));

vi.mock("./api-client", () => ({
  ...mocks,
  ApiError: class ApiError extends Error {
    status = 0;
  },
}));

describe("inspection API condition payloads", () => {
  it("includes pre-drive condition and all condition pins when finalizing", async () => {
    const report = {
      id: "inspection-1",
      revision: 4,
      overallPreDriveCondition: "FAIR",
      vehicleConditions: [{ id: "pin-2", number: 2, type: "DENT", x: 47.5, y: 62.3, area: "Rear Left" }],
    } as InspectionReport;
    mocks.apiPost.mockResolvedValue({ item: report });

    await inspectionApi.finalize(report);

    expect(mocks.apiPost).toHaveBeenCalledWith("/api/inspections/inspection-1/finalize", {
      revision: 4,
      overallPreDriveCondition: "FAIR",
      vehicleConditions: report.vehicleConditions,
    });
  });
});