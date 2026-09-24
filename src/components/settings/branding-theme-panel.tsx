"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Plus, Save, Trash2, Type, Upload } from "lucide-react";
import { toast } from "sonner";
import { CompanyBrandColorCard } from "@/components/settings/company-brand-color-card";
import { ImageCropDialog } from "@/components/settings/image-crop-dialog";
import { LoginHeroPanel } from "@/components/shared/login-hero-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { ApiError, apiPostForm } from "@/lib/api-client";
import {
  DEFAULT_LOGIN_HERO_DESCRIPTION,
  DEFAULT_LOGIN_HERO_FEATURES,
  DEFAULT_LOGIN_HERO_HEADING,
  LOGIN_HERO_MAX_FEATURES,
  resolveLoginHeroContent,
  type LoginHeroFeature,
} from "@/lib/login-hero-content";
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

function cloneFeatures(features: LoginHeroFeature[]): LoginHeroFeature[] {
  return features.map((f) => ({ title: f.title, description: f.description }));
}

/**
 * Settings → Branding & Theme: logo, login background, hero copy, company brand color.
 */
export function BrandingThemePanel() {
  const businessName = useSettingsStore((s) => s.businessName);
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const loginBackgroundImage = useSettingsStore((s) => s.loginBackgroundImage);
  const savedHeading = useSettingsStore((s) => s.loginHeroHeading);
  const savedDescription = useSettingsStore((s) => s.loginHeroDescription);
  const savedFeatures = useSettingsStore((s) => s.loginHeroFeatures);
  const setBusinessProfile = useSettingsStore((s) => s.setBusinessProfile);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);

  const [draftHeading, setDraftHeading] = useState(savedHeading);
  const [draftDescription, setDraftDescription] = useState(savedDescription);
  const [draftFeatures, setDraftFeatures] = useState<LoginHeroFeature[]>(() =>
    cloneFeatures(savedFeatures)
  );

  useEffect(() => {
    setDraftHeading(savedHeading);
    setDraftDescription(savedDescription);
    setDraftFeatures(cloneFeatures(savedFeatures));
  }, [savedHeading, savedDescription, savedFeatures]);

  useEffect(() => {
    return () => {
      if (logoCropSrc?.startsWith("blob:")) URL.revokeObjectURL(logoCropSrc);
    };
  }, [logoCropSrc]);

  const logoPreview = resolveUploadsPublicUrl(businessLogo);
  const bgPreview = resolveUploadsPublicUrl(loginBackgroundImage);

  const previewHero = resolveLoginHeroContent({
    heading: draftHeading,
    description: draftDescription,
    features: draftFeatures,
  });

  const contentDirty =
    draftHeading !== savedHeading ||
    draftDescription !== savedDescription ||
    JSON.stringify(draftFeatures) !== JSON.stringify(savedFeatures);

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

  const onBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBgUploading(true);
    try {
      const url = await uploadBrandingImage(file);
      setBusinessProfile({ loginBackgroundImage: url });
      toast.success("Login background updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not upload background.");
    } finally {
      setBgUploading(false);
    }
  };

  const updateFeature = (index: number, patch: Partial<LoginHeroFeature>) => {
    setDraftFeatures((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const removeFeature = (index: number) => {
    setDraftFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    setDraftFeatures((prev) => {
      if (prev.length >= LOGIN_HERO_MAX_FEATURES) return prev;
      return [...prev, { title: "", description: "" }];
    });
  };

  const saveHeroContent = () => {
    const features = draftFeatures
      .map((f) => ({
        title: f.title.trim(),
        description: f.description.trim(),
      }))
      .slice(0, LOGIN_HERO_MAX_FEATURES);
    setBusinessProfile({
      loginHeroHeading: draftHeading.trim(),
      loginHeroDescription: draftDescription.trim(),
      loginHeroFeatures: features,
    });
    toast.success("Login screen content saved");
  };

  const resetHeroToDefaults = () => {
    setDraftHeading("");
    setDraftDescription("");
    setDraftFeatures(cloneFeatures(DEFAULT_LOGIN_HERO_FEATURES));
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Login Page Background
          </CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Optional image for the left branding panel on the login screen. If empty, the default
            gradient is used.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={bgInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={onBgChange}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bgUploading}
              onClick={() => bgInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {bgUploading
                ? "Uploading…"
                : loginBackgroundImage
                  ? "Replace background"
                  : "Upload background"}
            </Button>
            {loginBackgroundImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  setBusinessProfile({ loginBackgroundImage: "" });
                  toast.message("Login background removed");
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remove
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="w-4 h-4" />
            Login Screen Content
          </CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Heading, description, and optional feature highlights on the left login panel. Leave
            heading or description blank to use defaults. Remove all features to hide that block.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-hero-heading">Hero heading</Label>
                <Input
                  id="login-hero-heading"
                  value={draftHeading}
                  onChange={(e) => setDraftHeading(e.target.value)}
                  placeholder={DEFAULT_LOGIN_HERO_HEADING}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-hero-description">Hero description</Label>
                <Textarea
                  id="login-hero-description"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder={DEFAULT_LOGIN_HERO_DESCRIPTION}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Feature highlights</Label>
                  <span className="text-xs text-muted-foreground">
                    {draftFeatures.length}/{LOGIN_HERO_MAX_FEATURES}
                  </span>
                </div>
                {draftFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-border p-3 bg-muted/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Feature {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        onClick={() => removeFeature(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                    <Input
                      value={feature.title}
                      onChange={(e) => updateFeature(index, { title: e.target.value })}
                      placeholder="Title"
                    />
                    <Input
                      value={feature.description}
                      onChange={(e) => updateFeature(index, { description: e.target.value })}
                      placeholder="Short description"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draftFeatures.length >= LOGIN_HERO_MAX_FEATURES}
                  onClick={addFeature}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add feature
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" disabled={!contentDirty} onClick={saveHeroContent}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save content
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={resetHeroToDefaults}>
                  Reset to defaults
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Live login preview</Label>
              <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                <LoginHeroPanel
                  compact
                  className="h-[420px] w-full"
                  businessName={businessName || "MY DETAIL OS"}
                  logoUrl={logoPreview}
                  backgroundUrl={bgPreview}
                  heading={previewHero.heading}
                  description={previewHero.description}
                  features={previewHero.features}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Preview updates as you type. Background and logo use the saved uploads above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <CompanyBrandColorCard />
    </div>
  );
}
