import { useEffect, useState } from "react";

import { HUB_QR_DARK, HUB_QR_LIGHT } from "@/lib/hub/theme";

/**
 * The link as something a person can point a camera at.
 *
 * Drawn in the browser - no image generation and no server call, the same way
 * the field app's QR works. Follows the lesson recorded on that component: the
 * code is near-black on a WHITE tile with a real quiet zone. An earlier version
 * drew it navy-on-navy and could not be scanned in poor light.
 *
 * The contrast is a scannability requirement, not a brand choice, which is why
 * the QR's two colours live in `src/lib/hub/theme.ts` with the rest of the
 * launcher's unavoidable literals and not in this file.
 */
export function ProductQr({ url, label, size = 200 }: { url: string; label: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // Imported here, NOT at the top of the file.
        //
        // `qrcode`'s Node entry is `lib/index.js` -> `require('./server')`, which
        // is the server-side canvas path; only the bundler's `browser` field swaps
        // in a DOM build. A static import therefore evaluated that Node path during
        // the SERVER render, which threw and took the whole route down with it:
        // React error #419 on every load, and not one tile in the server's HTML.
        // It is only ever needed after a tap, so load it then and keep the server
        // render clean.
        const { default: QRCode } = await import("qrcode");
        const markup = await QRCode.toString(url, {
          type: "svg",
          margin: 0,
          width: size,
          errorCorrectionLevel: "M",
          color: { dark: HUB_QR_DARK, light: HUB_QR_LIGHT },
        });
        if (live) setSvg(markup);
      } catch {
        // No code, no crash: the tile keeps its white box and the panel still
        // offers every other way to send the link.
      }
    })();
    return () => {
      live = false;
    };
  }, [url, size]);

  return (
    <div
      className="shrink-0 rounded-xl bg-white p-3 shadow-raised"
      style={{ width: size + 24, height: size + 24 }}
      data-testid="hub-qr"
    >
      <div
        role="img"
        aria-label={`QR code for ${label}. Scan it with a phone camera to open the link.`}
        className="size-full [&>svg]:size-full"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
    </div>
  );
}
