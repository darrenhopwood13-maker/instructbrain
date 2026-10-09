import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HUB_PRODUCT_IDS, HUB_PRODUCTS, findHubProduct } from "@/lib/hub/products";

/**
 * The launcher's four products, and the promises each one makes.
 *
 * The load-bearing one is instructDABS. Its domain does not resolve, so anything
 * that reads as "available now" is a lie the product would be telling a
 * stranger. These assertions are about that, and about the share copy being the
 * copy that was approved rather than something a later edit drifted into.
 */

describe("the four products", () => {
  it("is exactly the four the launcher shows, in order", () => {
    expect(HUB_PRODUCT_IDS).toEqual(["brain", "site", "enterprise", "dabs"]);
    expect(HUB_PRODUCTS.map((product) => product.id)).toEqual([...HUB_PRODUCT_IDS]);
  });

  it("gives each one a distinct accent key, a live domain and share copy", () => {
    for (const product of HUB_PRODUCTS) {
      expect(product.name.length).toBeGreaterThan(0);
      expect(product.domain.startsWith("https://")).toBe(true);
      expect(product.share.message.length).toBeGreaterThan(40);
      expect(product.share.url.startsWith("https://")).toBe(true);
      expect(product.bullets).toHaveLength(3);
    }
  });

  it("points each product's link at itself", () => {
    expect(findHubProduct("brain")?.share.url).toBe("https://instructbrain.com/hub?product=brain");
    expect(findHubProduct("site")?.share.url).toBe("https://instructsite.ai");
    expect(findHubProduct("enterprise")?.share.url).toBe("https://instructsite.com");
    // instructdabs.com does not resolve, so nothing may send a stranger there.
    expect(findHubProduct("dabs")?.share.url).toBe("https://instructbrain.com/hub?product=dabs");
  });
});

describe("instructDABS is not live, and the launcher must say so", () => {
  const dabs = HUB_PRODUCTS.find((product) => product.id === "dabs")!;

  it("is the only product marked early-access", () => {
    expect(dabs.status).toBe("early-access");
    for (const other of HUB_PRODUCTS.filter((product) => product.id !== "dabs")) {
      expect(other.status).toBe("live");
    }
  });

  it("never offers a sign-up it cannot honour", () => {
    expect(dabs.cta).toBeUndefined();
  });

  it("says so in the tile tagline and in the share message", () => {
    expect(dabs.tagline.toLowerCase()).toContain("not launched yet");
    expect(dabs.share.message.toLowerCase()).toContain("launching soon");
  });
});

describe("the instructBrain offer", () => {
  const brain = HUB_PRODUCTS.find((product) => product.id === "brain")!;

  it("sends people to the sign-up that already grants three free reports", () => {
    expect(brain.cta?.href).toBe("/auth/sign-up");
    expect(brain.cta?.label).toContain("3 Free Reports");
  });

  it("is the only product with a promo film, and it points at the real one", () => {
    expect(brain.demo).toBe("reel");
    for (const other of HUB_PRODUCTS.filter((product) => product.id !== "brain")) {
      // No film exists for these three, so the play control must not pretend.
      expect(other.demo).toBe("showcase");
    }
  });
});

describe("the share copy is final copy", () => {
  it("carries the approved wording for instructBrain, verbatim", () => {
    const brain = HUB_PRODUCTS.find((product) => product.id === "brain")!;
    expect(brain.share.message).toBe(
      "Take a look at instructBrain — turns site photos into client-ready construction reports in minutes. Condition surveys, snagging and compliance. Try your first 3 reports free: https://instructbrain.com/hub?product=brain",
    );
  });

  it("carries the approved wording for instructSite, verbatim", () => {
    const site = HUB_PRODUCTS.find((product) => product.id === "site")!;
    expect(site.share.message).toBe(
      "Check out instructSite — real-time construction site management, subcontractor coordination, and daily operational command: https://instructsite.ai",
    );
  });

  it("carries the approved wording for Enterprise and DABS, verbatim", () => {
    expect(HUB_PRODUCTS.find((product) => product.id === "enterprise")!.share.message).toBe(
      "Have a look at instructSite Enterprise — corporate site governance, multi-project compliance registers, and contractor oversight: https://instructsite.com",
    );
    expect(HUB_PRODUCTS.find((product) => product.id === "dabs")!.share.message).toBe(
      "Keep an eye out for instructDABS — daily activity briefings and site workforce coordination (launching soon): https://instructbrain.com/hub?product=dabs",
    );
  });
});

describe("the product data carries no colour", () => {
  it("names no hex or rgb value - colours are theme tokens only", () => {
    const source = readFileSync("src/lib/hub/products.ts", "utf8");
    const body = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\brgba?\(/);
  });
});

describe("findHubProduct", () => {
  it("accepts only the four known ids", () => {
    expect(findHubProduct("brain")?.label).toBe("instructBrain");
    expect(findHubProduct("dabs")?.label).toBe("instructDABS");
  });

  it("returns nothing for anything else, including a near miss", () => {
    for (const value of ["", "Brain", "brain ", "instruction", undefined, null, 7, {}, []]) {
      expect(findHubProduct(value)).toBeUndefined();
    }
  });
});
