import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCustomerVehicles } from "./vehicle-store";
import type { Vehicle } from "@/types";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiGet: mocks.get, apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn(), ApiError: class extends Error {} }));
vi.mock("@/lib/collection-sync", () => ({ postVehicleSnapshot: vi.fn() }));
beforeEach(() => { mocks.get.mockReset(); });

describe("fetchCustomerVehicles", () => {
  it("loads all pages, filters owner and deduplicates without overwriting the shared directory", async () => {
    const first = { id: "v1", customerId: "c1" } as Vehicle;
    const second = { id: "v2", customerId: "c1" } as Vehicle;
    mocks.get.mockResolvedValueOnce({ vehicles: [first, { id: "other", customerId: "c2" }], metadata: { totalPages: 2 } })
      .mockResolvedValueOnce({ vehicles: [first, second], metadata: { totalPages: 2 } });
    expect(await fetchCustomerVehicles("c1")).toEqual([first, second]);
    expect(mocks.get).toHaveBeenNthCalledWith(1, "/api/vehicles?customerId=c1&page=1&pageSize=50");
    expect(mocks.get).toHaveBeenNthCalledWith(2, "/api/vehicles?customerId=c1&page=2&pageSize=50");
  });
  it("supports the existing unpaginated response shape", async () => {
    mocks.get.mockResolvedValue({ vehicles: [{ id: "v1", customerId: "c1" }] });
    expect(await fetchCustomerVehicles("c1")).toHaveLength(1);
    expect(mocks.get).toHaveBeenCalledOnce();
  });
  it("propagates a failed request instead of returning an empty vehicle list", async () => {
    mocks.get.mockRejectedValue(new Error("Network unavailable"));
    await expect(fetchCustomerVehicles("c1")).rejects.toThrow("Network unavailable");
  });
});