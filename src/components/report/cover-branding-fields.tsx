import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

/**
 * The cover photo and logo step shown when a report is created. Both are
 * optional: no cover falls back to the first photograph on the report, and
 * no per-report logo falls back to the organisation's saved logo.
 */
export function CoverBrandingFields({
  organisationId,
  coverFile,
  logoFile,
  onCoverFile,
  onLogoFile,
  disabled = false,
}: {
  organisationId: string | null;
  coverFile: File | null;
  logoFile: File | null;
  onCoverFile: (file: File | null) => void;
  onLogoFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [defaultLogoUrl, setDefaultLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setDefaultLogoUrl(null);
    if (!organisationId) return;
    void (async () => {
      const { data } = await supabase
        .from("organisations")
        .select("logo_path")
        .eq("id", organisationId)
        .maybeSingle();
      const path = data?.logo_path;
      if (!path || !active) return;
      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 300);
      if (active) setDefaultLogoUrl(signed?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [organisationId]);

  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );
  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  return (
    <section
      aria-labelledby="cover-branding-heading"
      className="mt-8 max-w-2xl rounded-xl border border-border bg-surface-raised p-5"
    >
      <p className="eyebrow">Cover &amp; branding</p>
      <h2 id="cover-branding-heading" className="editorial-title mt-1.5 text-lg font-semibold">
        Title page photo and logo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Both are optional. Without a cover photo the report's first photograph is used, and any
        photograph can be set as the cover later.
      </p>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a cover photo"
        onChange={(event) => {
          onCoverFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a logo for this report"
        onChange={(event) => {
          onLogoFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Cover photo</p>
        {coverPreview ? (
          <div className="flex items-center gap-3">
            <img
              src={coverPreview}
              alt="Chosen cover photo"
              className="h-20 w-28 rounded-lg border border-border object-cover"
            />
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={disabled}
              onClick={() => onCoverFile(null)}
            >
              <X aria-hidden="true" />
              Remove
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => coverInputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            Choose a cover photo
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium">Logo</p>
        {logoPreview ? (
          <div className="flex items-center gap-3">
            <img
              src={logoPreview}
              alt="Logo for this report"
              className="h-12 max-w-40 rounded-lg border border-border bg-paper object-contain p-1"
            />
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={disabled}
              onClick={() => onLogoFile(null)}
            >
              Use the organisation logo instead
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {defaultLogoUrl ? (
              <img
                src={defaultLogoUrl}
                alt="Your organisation logo"
                className="h-12 max-w-40 rounded-lg border border-border bg-paper object-contain p-1"
              />
            ) : null}
            <p className="text-sm text-muted-foreground">
              {defaultLogoUrl
                ? "Your saved organisation logo appears on the title page."
                : "No organisation logo is saved yet."}
            </p>
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={disabled}
              onClick={() => logoInputRef.current?.click()}
            >
              Use a different logo for this report
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
