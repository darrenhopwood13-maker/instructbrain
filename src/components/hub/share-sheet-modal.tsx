import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle, MessageSquare, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { ProductQr } from "@/components/hub/product-qr";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canShareNatively, copyLink, shareLinksFor, shareNatively } from "@/lib/hub/share";
import type { HubProduct } from "@/lib/hub/products";

/**
 * What one tap on a product gives you: the QR code, and the ways to send it.
 *
 * In person, the other person points a camera at the code and the product opens
 * on their phone - no typing, no asking them to spell their number. At a
 * distance, the platform buttons below open a compose window with the pitch
 * already written.
 *
 * Nothing here sends anything: every platform action is a link that opens
 * somebody else's compose screen, and the person still presses send themselves.
 */
export function ShareSheetModal({
  product,
  open,
  onOpenChange,
}: {
  product: HubProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Client-only: the server cannot know whether this device has a share sheet,
  // and rendering the button during SSR would then vanish on hydration.
  const [canNative, setCanNative] = useState(false);
  useEffect(() => {
    setCanNative(canShareNatively());
  }, []);

  if (!product) return null;

  const links = shareLinksFor(product.share);

  const actions = [
    { key: "whatsapp", label: "WhatsApp", href: links.whatsapp, Icon: MessageCircle },
    { key: "sms", label: "SMS", href: links.sms, Icon: MessageSquare },
    { key: "telegram", label: "Telegram", href: links.telegram, Icon: Send },
    { key: "email", label: "Email", href: links.email, Icon: Mail },
  ] as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="hub max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t"
        data-product={product.id}
        data-testid="hub-send-panel"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="hub-wordmark hub-wordmark-tile">
            <span className="hub-wordmark-instruct">instruct</span>
            <span className="hub-wordmark-name">{product.name}</span>
          </SheetTitle>
          <SheetDescription>
            Let them scan it with a camera, or send the message to someone further away. Nothing is
            sent until you press send in your own app.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col items-center gap-3">
          <ProductQr url={product.share.url} label={product.label} />
          <p className="hub-accent-text text-center text-xs font-semibold uppercase tracking-[0.18em]">
            Point a camera at this
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          {canNative ? (
            <button
              type="button"
              className="hub-tile min-h-12 flex-row items-center gap-3 px-4 py-3 text-sm font-semibold"
              data-testid="hub-native-share"
              onClick={async () => {
                const outcome = await shareNatively(product.share);
                // A cancelled share says nothing and sends nothing.
                if (outcome === "shared") onOpenChange(false);
              }}
            >
              <Share2 className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
              <span>Share...</span>
            </button>
          ) : null}

          {actions.map(({ key, label, href, Icon }) => (
            <a
              key={key}
              href={href}
              className="hub-tile min-h-12 flex-row items-center gap-3 px-4 py-3 text-sm font-semibold"
              data-testid={`hub-fallback-${key}`}
            >
              <Icon className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}

          <button
            type="button"
            className="hub-tile min-h-12 flex-row items-center gap-3 px-4 py-3 text-sm font-semibold"
            data-testid="hub-fallback-copy"
            onClick={async () => {
              const copied = await copyLink(product.share.url);
              if (copied) {
                toast.success("Link copied");
              } else {
                // Never claim a copy that did not happen. The link is shown so
                // the person can still get it by hand.
                toast.error("Could not copy the link - the address is shown below.");
              }
            }}
          >
            <Copy className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
            <span>Copy link</span>
          </button>
        </div>

        <p className="hub-accent-text mt-4 break-all text-xs" data-testid="hub-share-url">
          {product.share.url}
        </p>
      </SheetContent>
    </Sheet>
  );
}
