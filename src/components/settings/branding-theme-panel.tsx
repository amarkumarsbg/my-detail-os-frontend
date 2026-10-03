"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CompanyBrandColorCard } from "@/components/settings/company-brand-color-card";
import { ImageCropDialog } from "@/components/settings/image-crop-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { ApiError, apiPostForm } from "@/lib/api-client";
import { useSettingsStore } from "@/store/settings-store";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

async function uploadBrandingImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("logo", file);
  const data = await apiPostForm<{ url: string }>("/api/collections/appSettings/logo", fd);
  return data.url;
}

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Choose an image file (JPEG, PNG, WebP, or GIF).";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

/**
 * Settings → Branding & Theme: company logo and brand color.
 * Login-page background and hero copy are platform-owned (not workshop-editable).
 */
export function BrandingThemePanel() {
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const setBusinessProfile = useSettingsStore((s) => s.setBusinessProfile);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoCropSrc?.startsWith("blob:")) URL.revokeObjectURL(logoCropSrc);
    };
  }, [logoCropSrc]);

  const logoPreview = resolveUploadsPublicUrl(businessLogo);

  const closeLogoCrop = () => {
    setLogoCropSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setLogoCropSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const uploadCroppedLogo = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await uploadBrandingImage(file);
      setBusinessProfile({ businessLogo: url });
      toast.success("Company logo updated");
      closeLogoCrop();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not upload logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ImageCropDialog
        open={Boolean(logoCropSrc)}
        imageSrc={logoCropSrc}
        title="Adjust company logo"
        description="Drag to move and zoom to choose which part of the image to keep. Crop is square for sidebar and header."
        aspect={1}
        confirmLabel={logoUploading ? "Uploading…" : "Save logo"}
        onCancel={closeLogoCrop}
        onConfirm={uploadCroppedLogo}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Company Logo
          </CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Shown in the sidebar, header, and login screen. Upload JPEG, PNG, WebP, or GIF (max 5
            MB). You can crop and adjust after selecting a file.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={onLogoChange}
          />
          <div className="flex flex-col items-start gap-3">
            {logoPreview ? (
              <div className="rounded-md border border-border bg-background p-3 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Company logo preview"
                  className="h-20 w-20 rounded-md object-contain bg-muted/40"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground">
                No logo
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {logoUploading ? "Uploading…" : businessLogo ? "Replace logo" : "Upload logo"}
              </Button>
              {businessLogo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setBusinessProfile({ businessLogo: "" });
                    toast.message("Company logo removed");
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <CompanyBrandColorCard />
    </div>
  );
}
