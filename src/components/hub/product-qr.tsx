import { useEffect, useState } from "react";
import QRCode from "qrcode";

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
    void QRCode.toString(url, {
      type: "svg",
      margin: 0,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: HUB_QR_DARK, light: HUB_QR_LIGHT },
    }).then((markup) => {
      if (live) setSvg(markup);
    });
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
