import { describe, expect, it } from "vitest";
import {
  inspectionAssetApiPath,
  isProtectedInspectionAssetUrl,
  resolveInspectionPhotoDisplayUrl,
} from "./inspection-media";

describe("inspection media urls", () => {
  it("detects protected inspection asset API paths", () => {
    expect(inspectionAssetApiPath("/api/inspections/assets/abc-123")).toBe("/api/inspections/assets/abc-123");
    expect(inspectionAssetApiPath("https://api.example.com/api/inspections/assets/abc-123")).toBe(
      "/api/inspections/assets/abc-123"
    );
    expect(isProtectedInspectionAssetUrl("/api/inspections/assets/abc-123")).toBe(true);
  });

  it("does not treat public upload paths as protected assets", () => {
    expect(inspectionAssetApiPath("/uploads/job-cards/x/before/a.jpg")).toBeNull();
    expect(isProtectedInspectionAssetUrl("/uploads/avatars/user.png")).toBe(false);
  });

  it("does not invent a public display URL for protected assets", () => {
    expect(resolveInspectionPhotoDisplayUrl("/api/inspections/assets/abc-123")).toBeUndefined();
  });
});
