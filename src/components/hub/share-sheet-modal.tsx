import { useEffect, useState } from "react";
import { ChevronDown, Copy, Mail, MessageCircle, MessageSquare, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { ProductQr } from "@/components/hub/product-qr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * The QR is the whole point of the panel - in person, the other person points a
 * camera at it and the product opens on their phone, with no typing and no
 * asking for a number. So the panel is built around it and kept SHORT: the five
 * platform options live in a dropdown rather than stacked down the screen, which
 * is what previously pushed the last of them off the bottom and made a panel
 * that had to be scrolled. A menu is also the honest shape for "the other ways".
 *
 * Nothing here sends anything: every platform option is a link that opens
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
      {/*
        max-h plus overflow is a safety net for a very short screen (landscape, a
        small tablet split view): the content is sized to fit a phone without
        scrolling, and this only ever scrolls when it genuinely cannot fit, so it
        can never strand an option below an unreachable edge.
      */}
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
            Let them scan it, or send the link. Nothing sends until you press send.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex flex-col items-center gap-2">
          <ProductQr url={product.share.url} label={product.label} />
          <p className="hub-accent-text text-center text-xs font-semibold uppercase tracking-[0.18em]">
            Point a camera at this
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          {canNative ? (
            <button
              type="button"
              className="hub-tile min-h-12 flex-row items-center justify-center gap-3 px-4 py-3 text-sm font-semibold"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hub-tile min-h-12 flex-row items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
                data-testid="hub-send-menu"
              >
                <Send className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
                <span>{canNative ? "Other ways to send" : "Send the link"}</span>
                <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            {/*
              Carries its own product scope: Radix portals the menu to the body,
              so it is not a descendant of the sheet and would otherwise fall back
              to the wrong accent.
            */}
            <DropdownMenuContent
              align="center"
              side="top"
              sideOffset={8}
              className="hub w-[min(20rem,calc(100vw-2rem))]"
              data-product={product.id}
              data-testid="hub-send-menu-content"
            >
              <DropdownMenuLabel>Send it on</DropdownMenuLabel>
              {actions.map(({ key, label, href, Icon }) => (
                <DropdownMenuItem key={key} asChild className="min-h-11">
                  <a href={href} data-testid={`hub-fallback-${key}`}>
                    <Icon className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11"
                data-testid="hub-fallback-copy"
                onSelect={async () => {
                  const copied = await copyLink(product.share.url);
                  if (copied) {
                    toast.success("Link copied");
                  } else {
                    // Never claim a copy that did not happen.
                    toast.error("Could not copy the link.");
                  }
                }}
              >
                <Copy className="hub-accent-text size-4 shrink-0" aria-hidden="true" />
                <span>Copy link</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SheetContent>
    </Sheet>
  );
}
