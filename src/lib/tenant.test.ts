import { describe, expect, it } from "vitest";
import {
  isReservedSlug,
  parseOrgSlugFromPathname,
  stripOrgSlugFromPath,
  tenantPath,
} from "./tenant";

describe("tenant helpers", () => {
  it("treats platform routes as reserved", () => {
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(isReservedSlug("saas-admin")).toBe(true);
    expect(isReservedSlug("customer")).toBe(true);
    expect(isReservedSlug("_next")).toBe(true);
    expect(isReservedSlug("offers")).toBe(true);
    expect(isReservedSlug("support")).toBe(true);
    expect(isReservedSlug("inspections")).toBe(true);
    expect(isReservedSlug("abcd-detailers")).toBe(false);
    // Real org slugs must NOT be reserved or /{slug}/login 404s
    expect(isReservedSlug("prime-detailers")).toBe(false);
    expect(isReservedSlug("my-detail-os")).toBe(false);
  });

  it("parses org slug from pathname", () => {
    expect(parseOrgSlugFromPathname("/abcd-detailers/dashboard")).toBe("abcd-detailers");
    expect(parseOrgSlugFromPathname("/prime-detailers/login")).toBe("prime-detailers");
    expect(parseOrgSlugFromPathname("/dashboard")).toBe(null);
    expect(parseOrgSlugFromPathname("/saas-admin/organizations")).toBe(null);
    expect(parseOrgSlugFromPathname("/offers")).toBe(null);
    expect(parseOrgSlugFromPathname("/support")).toBe(null);
    expect(parseOrgSlugFromPathname("/inspections/new")).toBe(null);
  });

  it("strips org slug for route matching", () => {
    expect(stripOrgSlugFromPath("/abcd-detailers/dashboard")).toBe("/dashboard");
    expect(stripOrgSlugFromPath("/prime-detailers/login")).toBe("/login");
    expect(stripOrgSlugFromPath("/abcd-detailers/customer/login")).toBe("/customer/login");
    expect(stripOrgSlugFromPath("/dashboard")).toBe("/dashboard");
    expect(stripOrgSlugFromPath("/my-detail-os/offers")).toBe("/offers");
    expect(stripOrgSlugFromPath("/offers")).toBe("/offers");
  });

  it("prefixes tenant paths when slug present", () => {
    expect(tenantPath("abcd-detailers", "/dashboard")).toBe("/abcd-detailers/dashboard");
    expect(tenantPath("prime-detailers", "/login")).toBe("/prime-detailers/login");
    expect(tenantPath(null, "/dashboard")).toBe("/dashboard");
    expect(tenantPath("", "/customer/login")).toBe("/customer/login");
  });

  it("does not double-prefix an already tenant-scoped path", () => {
    expect(tenantPath("my-detail-os", "/my-detail-os/dashboard")).toBe(
      "/my-detail-os/dashboard"
    );
    expect(tenantPath("my-detail-os", "/my-detail-os/login")).toBe("/my-detail-os/login");
    expect(tenantPath("my-detail-os", "/other-org/dashboard")).toBe(
      "/my-detail-os/dashboard"
    );
  });
});
