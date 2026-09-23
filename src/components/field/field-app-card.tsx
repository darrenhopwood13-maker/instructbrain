import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Desk-side handover: scan this with a phone camera and the field app opens,
 * ready to be added to the home screen. The QR code is drawn in the browser —
 * no image generation, no server call.
 *
 * The code is near-black on a white tile with a padded quiet zone: the
 * contrast a phone camera expects. An earlier version drew navy-on-navy and
 * was unscannable in poor light.
 */
export function FieldAppCard() {
  const url = absoluteUrl("/field");
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void QRCode.toString(url, {
      type: "svg",
      margin: 0,
      width: 160,
      color: { dark: "#101828", light: "#00000000" },
    }).then((markup) => {
      if (live) setSvg(markup);
    });
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <section
      aria-labelledby="field-app-heading"
      className="mt-6 hidden rounded-xl border border-border bg-surface-raised p-4 shadow-raised sm:block"
    >
      <div className="flex flex-wrap items-center gap-5">
        <div className="size-32 shrink-0 rounded-lg bg-white p-2 shadow-raised">
          <div
            role="img"
            aria-label="QR code. Scan to open the instructBrain field app."
            className="size-full [&>svg]:size-full"
            dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
          />
        </div>
        <div className="min-w-0">
          <p className="eyebrow">On site</p>
          <h2 id="field-app-heading" className="editorial-title text-base font-semibold">
            Get the field app on your phone
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Scan this with your phone camera. instructBrain opens and offers to add itself to your
            home screen, so capture is one tap away on site.
          </p>
          <p className="mt-2 break-all text-xs text-muted-foreground">{url}</p>
        </div>
      </div>
    </section>
  );
}
