// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FamilyTile } from "@/components/hub/family-tile";
import { ShareSheetModal } from "@/components/hub/share-sheet-modal";
import { HUB_PRODUCTS, type HubProduct } from "@/lib/hub/products";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
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

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  setClipboard(undefined);
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
    const wordmark = screen.getByText("Brain");
    expect(wordmark.className).toContain("hub-wordmark-name");
  });

  it("shares the product when the row is tapped", () => {
    const { onShare } = renderTile(brain);
    fireEvent.click(screen.getByRole("button", { name: /Share instructBrain/ }));
    expect(onShare).toHaveBeenCalledWith(brain);
  });

  it("is a large enough target for a thumb, by class and by label", () => {
    renderTile(brain);
    const share = screen.getByRole("button", { name: /Share instructBrain/ });
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

describe("the fallback share drawer", () => {
  it("offers all five actions, pointed at the right places", () => {
    render(<ShareSheetModal product={brain} open onOpenChange={() => undefined} />);

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

    // Every one of them opens a compose window rather than sending.
    for (const key of ["whatsapp", "sms", "telegram", "email"]) {
      expect(screen.getByTestId(`hub-fallback-${key}`).tagName).toBe("A");
    }
  });

  it("shows the link so it can still be taken by hand", () => {
    render(<ShareSheetModal product={brain} open onOpenChange={() => undefined} />);
    expect(screen.getByTestId("hub-share-url").textContent).toBe(brain.share.url);
  });

  it("confirms a copy that worked", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    render(<ShareSheetModal product={brain} open onOpenChange={() => undefined} />);
    fireEvent.click(screen.getByTestId("hub-fallback-copy"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"));
    expect(writeText).toHaveBeenCalledWith(brain.share.url);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("refuses to confirm a copy that failed", async () => {
    setClipboard(async () => {
      throw new Error("denied");
    });
    render(<ShareSheetModal product={brain} open onOpenChange={() => undefined} />);
    fireEvent.click(screen.getByTestId("hub-fallback-copy"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("renders nothing at all until a product is chosen", () => {
    render(<ShareSheetModal product={null} open={false} onOpenChange={() => undefined} />);
    expect(screen.queryByTestId("hub-fallback-copy")).toBeNull();
  });
});
