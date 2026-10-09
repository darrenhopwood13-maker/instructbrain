import { Copy, Mail, MessageCircle, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { copyLink, shareLinksFor } from "@/lib/hub/share";
import type { HubProduct } from "@/lib/hub/products";

/**
 * The fallback drawer for devices with no share sheet - desktop, and some
 * in-app webviews.
 *
 * Every action is an `<a>` that opens a compose window, except Copy Link which
 * writes to the clipboard and says so only when it actually worked. Nothing
 * here sends a message: the person still has to press send in their own app.
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
        className="hub max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t"
        data-product={product.id}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="hub-wordmark hub-wordmark-tile">
            <span className="hub-wordmark-instruct">instruct</span>
            <span className="hub-wordmark-name">{product.name}</span>
          </SheetTitle>
          <SheetDescription>
            Your phone could not open a share sheet, so pick where to send it. The message is written
            and waiting - you still press send yourself.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-2">
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
