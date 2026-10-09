// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PromoFilm } from "@/components/hub/promo-film";
import { HUB_PRODUCTS } from "@/lib/hub/products";

/**
 * The film each play control opens.
 *
 * The launcher now carries two films, and instructSite's is served from a
 * different origin to this app. So the thing worth pinning is that the player
 * shows THAT product's film and says so honestly - and that a product with no
 * film renders no player at all, rather than a dead box over nothing.
 */

afterEach(cleanup);

const brain = HUB_PRODUCTS.find((product) => product.id === "brain")!;
const site = HUB_PRODUCTS.find((product) => product.id === "site")!;
const enterprise = HUB_PRODUCTS.find((product) => product.id === "enterprise")!;

describe("a product's promo film", () => {
  it("plays the film belonging to the product that opened it", () => {
    const { container } = render(<PromoFilm product={site} />);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe(site.film?.url);
    expect(video?.getAttribute("src")).toContain("instructsite.ai");
  });

  it("plays instructBrain's film for instructBrain, not another product's", () => {
    const { container } = render(<PromoFilm product={brain} />);
    const src = container.querySelector("video")?.getAttribute("src") ?? "";
    expect(src).toBe(brain.film?.url);
    expect(src).not.toContain("instructsite.ai");
  });

  it("states the real runtime, and that it has sound", () => {
    render(<PromoFilm product={site} />);
    expect(screen.getByText("33 seconds, with sound. This is the same film as instructSite's own promo page.")).toBeTruthy();
  });

  it("describes the film to a screen reader with its product and length", () => {
    const { container } = render(<PromoFilm product={site} />);
    expect(container.querySelector("video")?.getAttribute("aria-label")).toBe(
      "instructSite promo film, 33 seconds",
    );
  });

  it("renders no player at all for a product with no film", () => {
    const { container } = render(<PromoFilm product={enterprise} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByTestId("hub-film")).toBeNull();
  });

  it("autoplays only where the caller asks it to", () => {
    const { container } = render(<PromoFilm product={brain} />);
    expect(container.querySelector("video")?.hasAttribute("autoplay")).toBe(false);
    cleanup();
    const { container: modal } = render(<PromoFilm product={brain} autoPlay />);
    expect(modal.querySelector("video")?.hasAttribute("autoplay")).toBe(true);
  });

  it("names where the film does play when it will not load here", () => {
    const { container } = render(<PromoFilm product={site} />);
    fireEvent.error(container.querySelector("video")!);
    const note = screen.getByTestId("hub-film-fallback");
    expect(note.textContent).toContain("instructsite.ai");
    expect(note.textContent).toContain("instructSite");
    // And the dead player is gone, rather than sitting there blank.
    expect(container.querySelector("video")).toBeNull();
  });
});
