import { resolveUploadsPublicUrl } from "./api-base";
import { apiGetBlob } from "./api-client";

/** Backend stores private assets behind authenticated `/api/inspections/assets/:id` URLs. */
export function inspectionAssetApiPath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  if (value.startsWith("/api/inspections/assets/")) return value;
  try {
    const parsed = new URL(value, "http://local.invalid");
    if (parsed.pathname.startsWith("/api/inspections/assets/")) return parsed.pathname;
  } catch {
    /* ignore invalid absolute URLs */
  }
  return null;
}

export function isProtectedInspectionAssetUrl(url: string | null | undefined): boolean {
  return Boolean(inspectionAssetApiPath(url));
}

/**
 * Browser-displayable URL for public `/uploads/...` paths.
 * Protected inspection assets must be loaded with {@link loadInspectionPhotoBlob} instead.
 */
export function resolveInspectionPhotoDisplayUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  if (isProtectedInspectionAssetUrl(url)) return undefined;
  return resolveUploadsPublicUrl(url);
}

/** Fetch photo bytes with auth when needed (`<img>` cannot send Bearer tokens). */
export async function loadInspectionPhotoBlob(url: string): Promise<Blob> {
  const apiPath = inspectionAssetApiPath(url);
  if (apiPath) return apiGetBlob(apiPath);

  const publicUrl = resolveUploadsPublicUrl(url);
  if (!publicUrl) throw new Error("Inspection photo is unavailable.");
  const response = await fetch(publicUrl);
  if (!response.ok) throw new Error("Could not load a report photo.");
  return response.blob();
}
