// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FamilyTile } from "@/components/hub/family-tile";
import { ProductQr } from "@/components/hub/product-qr";
import { ShareSheetModal } from "@/components/hub/share-sheet-modal";
import { HUB_PRODUCTS, type HubProduct } from "@/lib/hub/products";

const { toastSuccess, toastError, qrToString } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  // Typed parameters, so `mock.calls[0]` is a usable tuple rather than `[]`.
  qrToString: vi.fn(async (_url: string, _options: unknown) => "<svg data-testid='qr-svg'/>"),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock("qrcode", () => ({
  default: { toString: qrToString },
}));

const brain = HUB_PRODUCTS.find((product) => product.id === "brain")!;
const site = HUB_PRODUCTS.find((product) => product.id === "site")!;
const dabs = HUB_PRODUCTS.find((product) => product.id === "dabs")!;

function setClipboard(impl: (() => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, "clipboard", {
    value: impl ? { writeText: impl } : undefined,
    configurable: true,
  });
}

function setShare(impl: (() => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, "share", { value: impl, configurable: true });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  qrToString.mockClear();
  setClipboard(undefined);
  setShare(undefined);
  // Radix asks about motion preferences; jsdom has no matchMedia.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

// Without this the previous test's tree is still in the document, and every
// `getByRole` finds two of everything.
afterEach(() => {
  cleanup();
});

describe("a launcher tile", () => {
  const renderTile = (product: HubProduct) => {
    const onShare = vi.fn();
    const onDemo = vi.fn();
    render(<FamilyTile product={product} onShare={onShare} onDemo={onDemo} />);
    return { onShare, onDemo };
  };

  it("carries the product's wordmark, with the family's two-tone split", () => {
    renderTile(brain);
    expect(screen.getByText("Brain").className).toContain("hub-wordmark-name");
  });

  it("sends the product when the row is tapped", () => {
    const { onShare } = renderTile(brain);
    fireEvent.click(screen.getByRole("button", { name: /Send instructBrain/ }));
    expect(onShare).toHaveBeenCalledWith(brain);
  });

  it("promises a QR code and a link in its own label, because that is what it opens", () => {
    renderTile(brain);
    const label = screen.getByRole("button", { name: /Send instructBrain/ }).getAttribute("aria-label");
    expect(label).toMatch(/QR code/);
    expect(label).toMatch(/share the link/);
  });

  it("is a large enough target for a thumb, by class and by label", () => {
    renderTile(brain);
    const share = screen.getByRole("button", { name: /Send instructBrain/ });
    expect(share.className).toContain("min-h-12");
    expect(share.className).toContain("flex-1");
  });

  it("offers the film on the product that has one", () => {
    const { onDemo } = renderTile(brain);
    fireEvent.click(screen.getByRole("button", { name: "Play the instructBrain promo film" }));
    expect(onDemo).toHaveBeenCalledWith(brain);
  });

  it("offers the overview, not a film, on a product that has none", () => {
    renderTile(site);
    expect(screen.getByRole("button", { name: "Open the instructSite overview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /promo film/ })).toBeNull();
  });

  it("marks instructDABS as early access on the tile itself", () => {
    renderTile(dabs);
    expect(screen.getByTestId("hub-early-access").textContent).toMatch(/early access/i);
  });

  it("does not mark a live product as early access", () => {
    renderTile(site);
    expect(screen.queryByTestId("hub-early-access")).toBeNull();
  });
});

describe("the QR code", () => {
  it("encodes the product's own link, not its name", async () => {
    render(<ProductQr url={brain.share.url} label={brain.label} />);
    await waitFor(() => expect(qrToString).toHaveBeenCalled());
    expect(qrToString.mock.calls[0]?.[0]).toBe("https://instructbrain.com/hub?product=brain");
  });

  it("draws dark modules on white, which is what a camera needs", async () => {
    render(<ProductQr url={site.share.url} label={site.label} />);
    await waitFor(() => expect(qrToString).toHaveBeenCalled());
    const options = qrToString.mock.calls[0]?.[1] as {
      color: { dark: string; light: string };
      margin: number;
    };
    expect(options.color.dark).toBe("#101828");
    expect(options.color.light).toBe("#FFFFFF");
    expect(options.margin).toBe(0);
  });

  it("is described to a screen reader as something to scan", async () => {
    render(<ProductQr url={dabs.share.url} label={dabs.label} />);
    const img = await screen.findByRole("img");
    expect(img.getAttribute("aria-label")).toContain(dabs.label);
    expect(img.getAttribute("aria-label")).toMatch(/scan/i);
  });
});

describe("the send panel", () => {
  const openPanel = async (product: HubProduct) => {
    render(<ShareSheetModal product={product} open onOpenChange={() => undefined} />);
    return screen.findByTestId("hub-send-panel");
  };

  it("shows the QR code as the first thing, for an in-person handover", async () => {
    await openPanel(brain);
    await waitFor(() => expect(screen.getByTestId("hub-qr")).toBeTruthy());
    expect(qrToString.mock.calls[0]?.[0]).toBe(brain.share.url);
  });

  it("offers all five send actions, pointed at the right places", async () => {
    await openPanel(brain);
    expect(screen.getByTestId("hub-fallback-whatsapp").getAttribute("href")).toContain(
      "https://wa.me/?text=",
    );
    expect(screen.getByTestId("hub-fallback-sms").getAttribute("href")).toContain("sms:?&body=");
    expect(screen.getByTestId("hub-fallback-telegram").getAttribute("href")).toContain(
      "https://t.me/share/url?url=",
    );
    expect(screen.getByTestId("hub-fallback-email").getAttribute("href")).toContain(
      "mailto:?subject=",
    );
    expect(screen.getByTestId("hub-fallback-copy")).toBeTruthy();

    // Every one of them opens somebody else's compose window rather than sending.
    for (const key of ["whatsapp", "sms", "telegram", "email"]) {
      expect(screen.getByTestId(`hub-fallback-${key}`).tagName).toBe("A");
    }
  });

  it("offers the device's own share sheet only where one exists", async () => {
    await openPanel(brain);
    // jsdom has no navigator.share, so that action must not be there to fail.
    expect(screen.queryByTestId("hub-native-share")).toBeNull();
  });

  it("offers the device's share sheet where one exists", async () => {
    const share = vi.fn(async () => undefined);
    setShare(share);
    await openPanel(brain);
    const button = await screen.findByTestId("hub-native-share");
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalled());
  });

  it("shows the link so it can still be taken by hand", async () => {
    await openPanel(brain);
    expect(screen.getByTestId("hub-share-url").textContent).toBe(brain.share.url);
  });

  it("confirms a copy that worked", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    await openPanel(brain);
    fireEvent.click(screen.getByTestId("hub-fallback-copy"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"));
    expect(writeText).toHaveBeenCalledWith(brain.share.url);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("refuses to confirm a copy that failed", async () => {
    setClipboard(async () => {
      throw new Error("denied");
    });
    await openPanel(brain);
    fireEvent.click(screen.getByTestId("hub-fallback-copy"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("renders nothing at all until a product is chosen", () => {
    render(<ShareSheetModal product={null} open={false} onOpenChange={() => undefined} />);
    expect(screen.queryByTestId("hub-fallback-copy")).toBeNull();
  });
});
