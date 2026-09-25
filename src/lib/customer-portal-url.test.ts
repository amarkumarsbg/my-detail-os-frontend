import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getCustomerPortalAbsoluteUrl,
  getCustomerPortalLoginUrl,
} from "@/lib/customer-portal-url";

vi.mock("@/store/organization-store", () => ({
  useOrganizationStore: {
    getState: vi.fn(() => ({ entitlement: null })),
  },
}));

import { useOrganizationStore } from "@/store/organization-store";

describe("customer portal URLs", () => {
  beforeEach(() => {
    vi.mocked(useOrganizationStore.getState).mockReturnValue({
      entitlement: null,
    } as ReturnType<typeof useOrganizationStore.getState>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds slug login URL from explicit origin + slug", () => {
    expect(
      getCustomerPortalLoginUrl({
        origin: "http://localhost:3002",
        orgSlug: "my-detail-os",
      })
    ).toBe("http://localhost:3002/my-detail-os/customer/login");
  });

  it("falls back without slug", () => {
    expect(
      getCustomerPortalLoginUrl({
        origin: "http://localhost:3002",
        orgSlug: null,
      })
    ).toBe("http://localhost:3002/customer/login");
  });

  it("uses entitlement organization.slug when path/opts have none", () => {
    vi.mocked(useOrganizationStore.getState).mockReturnValue({
      entitlement: {
        organization: { id: "o1", name: "Acme Detailers", slug: "acme-detailers" },
      },
    } as ReturnType<typeof useOrganizationStore.getState>);

    expect(
      getCustomerPortalLoginUrl({
        origin: "http://localhost:3002",
        orgSlug: null,
      })
    ).toBe("http://localhost:3002/acme-detailers/customer/login");
  });

  it("builds tenant photo URLs", () => {
    expect(
      getCustomerPortalAbsoluteUrl("/customer/job-card/tok/photos", {
        origin: "http://localhost:3002",
        orgSlug: "my-detail-os",
      })
    ).toBe("http://localhost:3002/my-detail-os/customer/job-card/tok/photos");
  });
});
