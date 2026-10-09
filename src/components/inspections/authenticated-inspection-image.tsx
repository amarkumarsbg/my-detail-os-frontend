"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadInspectionPhotoBlob, resolveInspectionPhotoDisplayUrl } from "@/lib/inspection-media";

export function AuthenticatedInspectionImage({
  src,
  alt,
  className,
  loadBlob,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Override blob loader (e.g. customer JWT). Defaults to staff auth fetch. */
  loadBlob?: (url: string) => Promise<Blob>;
}) {
  const publicUrl = resolveInspectionPhotoDisplayUrl(src);
  const [objectUrl, setObjectUrl] = useState<string | null>(publicUrl ?? null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!publicUrl);

  useEffect(() => {
    const resolvedPublic = resolveInspectionPhotoDisplayUrl(src);
    if (resolvedPublic) {
      setObjectUrl(resolvedPublic);
      setFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let created: string | null = null;
    setLoading(true);
    setFailed(false);
    setObjectUrl(null);

    const fetchBlob = loadBlob ?? loadInspectionPhotoBlob;
    void fetchBlob(src)
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, loadBlob]);

  if (loading) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted text-muted-foreground", className)} role="status">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="sr-only">Loading photo</span>
      </div>
    );
  }

  if (failed || !objectUrl) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1 bg-muted px-3 text-center text-xs text-muted-foreground", className)}>
        <ImageOff className="h-5 w-5" />
        <span>Photo unavailable</span>
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}
