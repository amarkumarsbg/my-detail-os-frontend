import { describe, expect, it } from "vitest";
import { resourcesForPath } from "@/lib/domain-data-map";

describe("resourcesForPath", () => {
  it("maps dashboard to core pack", () => {
    const r = resourcesForPath("/dashboard");
    expect(r).toContain("jobCards");
    expect(r).toContain("dashboardStats");
    expect(r).not.toContain("payroll");
  });

  it("maps payroll without cashBank", () => {
    const r = resourcesForPath("/payroll");
    expect(r).toContain("payroll");
    expect(r).toContain("staff");
    expect(r).toContain("staffRewards");
    expect(r).not.toContain("cashBank");
  });

  it("maps rewards and includes staffRewards on performance", () => {
    expect(resourcesForPath("/rewards")).toContain("staffRewards");
    expect(resourcesForPath("/performance")).toContain("staffRewards");
  });

  it("prefers longest prefix", () => {
    const r = resourcesForPath("/job-cards/jc-001");
    expect(r).toContain("jobCards");
    expect(r).toContain("serviceCatalog");
    expect(r).toContain("branchStocks");
    expect(r).not.toContain("productPurchases");
  });

  it("loads appSettings for job-cards, booking, and payment pricing routes", () => {
    expect(resourcesForPath("/job-cards")).toContain("appSettings");
    expect(resourcesForPath("/job-cards/new")).toContain("appSettings");
    expect(resourcesForPath("/booking")).toContain("appSettings");
    expect(resourcesForPath("/bookings")).toContain("appSettings");
    expect(resourcesForPath("/billing")).toContain("appSettings");
    expect(resourcesForPath("/quotations")).toContain("appSettings");
    expect(resourcesForPath("/customers")).toContain("appSettings");
    expect(resourcesForPath("/parties")).toContain("appSettings");
  });

  it("loads accounting income dependencies including membership and payroll", () => {
    const r = resourcesForPath("/accounting");
    expect(r).toContain("invoices");
    expect(r).toContain("expenses");
    expect(r).toContain("jobCards");
    expect(r).toContain("productPurchases");
    expect(r).toContain("membership");
    expect(r).toContain("payroll");
  });

  it("strips tenant org slug before matching route packs", () => {
    const r = resourcesForPath("/my-detail-os/activity");
    expect(r).toContain("activityLogs");
    expect(r).toContain("jobCards");
    expect(resourcesForPath("/my-detail-os/dashboard")).toContain("dashboardStats");
    expect(resourcesForPath("/my-detail-os/dashboard")).not.toContain("activityLogs");
  });
});
