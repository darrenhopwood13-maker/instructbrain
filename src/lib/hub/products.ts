/**
 * The Instruct family launcher: the four products, in tile order, with the
 * share copy each one sends.
 *
 * The share messages are the REVERSE of a rendered string: they are the copy a
 * recipient reads in their own messaging app, so they live here as data rather
 * than being assembled inside a component. Do not "tidy" the wording, the
 * punctuation or the capitalisation - a change here changes what a stranger
 * receives from Dal's phone.
 *
 * Colours are deliberately NOT in this file. Each product's accent is a theme
 * token in `src/styles.css`, selected by `data-product`, so no component or
 * module carries a colour literal.
 */

export const HUB_PRODUCT_IDS = ["brain", "site", "enterprise", "dabs"] as const;

export type HubProductId = (typeof HUB_PRODUCT_IDS)[number];

/**
 * `early-access` is a promise the tile must keep: instructDABS has no live site
 * (the domain does not even resolve), so nothing in the launcher may imply it
 * can be bought or used today.
 */
export type HubProductStatus = "live" | "early-access";

export type HubProduct = {
  id: HubProductId;
  /** The wordmark name, always shown in the product's own accent. */
  name: string;
  /** The full product name, for headings and accessible labels. */
  label: string;
  /** Where a recipient is sent. */
  domain: string;
  /**
   * Where the tile's open control goes: into the product itself.
   *
   * Deliberately not `share.url` and not `domain`. `share.url` is where a
   * *recipient* is sent and `domain` is the front door; on instructBrain neither
   * of those is the app, so an owner tapping one lands on a page about the
   * product instead of inside it - which is exactly how the launcher ended up
   * with no way in.
   *
   * Absent where there is no app to open. instructDABS has no live site, so its
   * tile offers no control: one that went nowhere would undo the early-access
   * promise the rest of that tile keeps.
   */
  open?: {
    /** Relative for this app's own routes, absolute for another product's site. */
    href: string;
    /**
     * The button's own words, shown on the tile. Not a hidden accessible name:
     * a glyph beside a play control told nobody that it was the way in, so this
     * is the text on the button.
     */
    label: string;
    /** Another origin, so it opens in a new tab and leaves this page behind it. */
    external?: boolean;
  };
  status: HubProductStatus;
  /** One line under the wordmark in the recipient showcase. */
  tagline: string;
  /** Three bullets in the recipient showcase. */
  bullets: readonly string[];
  /**
   * What the tile's play control opens. `reel` plays the product's own promo
   * film (see `film`); anything else has no film, so the control opens the
   * showcase instead. Never fake a video for a product that has not got one.
   */
  demo: "reel" | "showcase";
  /**
   * The product's own promo film, and only where a film genuinely exists.
   *
   * `demo: "reel"` is a promise that this is set: the play control opens the
   * film rather than the showcase. A product with no film leaves this off and
   * opens the showcase instead - never a placeholder player over a film that
   * does not exist.
   *
   * `url` is not always this project's own asset store. Each film belongs to
   * the product it is about, and instructSite's is served from instructsite.ai,
   * which is where that product's own promo page plays it from.
   */
  film?: {
    url: string;
    /** Runtime in whole seconds, stated on screen so it is never guessed. */
    seconds: number;
    /** The origin that serves it, named when the film cannot be loaded. */
    source: string;
    /**
     * True ONLY where that product's own promo page plays this same film.
     *
     * The player tells the viewer where else they can watch it, so this is a
     * claim about another page and it is set only where that page really does
     * carry the film. instructBrain's ninety-second film lives in the launcher
     * only, so its entry leaves this off rather than pointing at a page playing
     * a different cut.
     */
    sameFilmAsPromoPage?: boolean;
  };
  share: {
    /** The message a recipient receives. Verbatim. */
    message: string;
    /** The link inside that message. */
    url: string;
    /** The email subject line. */
    subject: string;
  };
  cta?: {
    label: string;
    href: string;
    /** Small print under the CTA, where the offer needs stating. */
    note?: string;
  };
};

export const HUB_PRODUCTS: readonly HubProduct[] = [
  {
    id: "brain",
    name: "Brain",
    label: "instructBrain",
    domain: "https://instructbrain.com",
    // The app's own front door once you are signed in. `/dashboard` sits behind
    // the auth guard, so a signed-out stranger tapping it gets the sign-in page
    // rather than an error - which is the honest place for them.
    open: { href: "/dashboard", label: "Open dashboard" },
    status: "live",
    tagline:
      "Site photographs in, client-ready reports out - drafted by the AI, reviewed and published by you.",
    bullets: [
      "Defensible evidence: every photograph carries its own GPS, timestamp and capture details.",
      "The AI drafts each finding and cites the regulation it engages - you review and confirm before anything is published.",
      "A client-ready PDF the same afternoon, issued with a real reference and a frozen version.",
    ],
    demo: "reel",
    film: {
      // The ninety-second film, served from this app's own origin out of
      // `public/`, so it cannot depend on an asset id being re-issued. Portrait
      // 9:16, because this player is the portrait modal in the launcher.
      // When the film is replaced, replace the file AND `seconds` - the runtime
      // printed under the player is read from here, never guessed.
      url: "/instructbrain-promo-90s.mp4",
      seconds: 90,
      source: "instructbrain.com",
    },
    share: {
      message:
        "Take a look at instructBrain — turns site photos into client-ready reports in minutes, referenced against the regs that apply. Condition surveys, snagging and compliance. Try your first 3 reports free: https://instructbrain.com/hub?product=brain",
      url: "https://instructbrain.com/hub?product=brain",
      subject: "instructBrain - client-ready reports from site photographs",
    },
    cta: {
      label: "Start with 3 Free Reports — no card needed",
      href: "/auth/sign-up",
      note: "Free account, three reports. No card, no commitment.",
    },
  },
  {
    id: "site",
    name: "Site",
    label: "instructSite",
    domain: "https://instructsite.ai",
    open: { href: "https://instructsite.ai", label: "Open instructSite", external: true },
    status: "live",
    tagline:
      "Real-time construction site management - subcontractor coordination and daily operational command.",
    bullets: [
      "Programme, packages and trades in one place, with the day's work visible to everyone who needs it.",
      "Daily diaries, inspections and sign-offs captured on site, not reconstructed in the office.",
      "One live view across every active site, so nothing is chased twice.",
    ],
    demo: "reel",
    film: {
      // Absolute and cross-origin, and checked as such: the film is served by
      // instructsite.ai's own asset store, which is the origin that product's
      // promo page plays it from. It answers range requests, so the player can
      // seek, and it does not block a foreign referer.
      //
      // IF THE FILM STOPS LOADING: check the asset id against
      // `src/assets/instructsite-promo.mp4.asset.json` in the site-mind-forge
      // repo and update the id here. A re-upload there gets a new id.
      url: "https://instructsite.ai/__l5e/assets-v1/02e16568-f992-4b9a-8531-597b9496dd2a/instructsite-promo.mp4",
      seconds: 33,
      source: "instructsite.ai",
      // instructSite's own promo page plays this exact file, so the player may
      // send a viewer there. True because it was checked, not because it is tidy.
      sameFilmAsPromoPage: true,
    },
    share: {
      message:
        "Check out instructSite — real-time construction site management, subcontractor coordination, and daily operational command: https://instructsite.ai",
      url: "https://instructsite.ai",
      subject: "instructSite - real-time construction site management",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    label: "instructSite Enterprise",
    domain: "https://instructsite.com",
    open: {
      href: "https://instructsite.com",
      label: "Open instructSite Enterprise",
      external: true,
    },
    status: "live",
    tagline:
      "Corporate site governance for contractors running more than one job.",
    bullets: [
      "Multi-project compliance registers that roll up to the group, not to an individual site.",
      "Contractor oversight, approvals and the audit trail behind every decision.",
      "Group-level reporting built for the people who answer to a board.",
    ],
    demo: "showcase",
    share: {
      message:
        "Have a look at instructSite Enterprise — corporate site governance, multi-project compliance registers, and contractor oversight: https://instructsite.com",
      url: "https://instructsite.com",
      subject: "instructSite Enterprise - corporate site governance",
    },
  },
  {
    id: "dabs",
    name: "DABS",
    label: "instructDABS",
    domain: "https://instructdabs.com",
    status: "early-access",
    tagline:
      "Daily activity briefings and site workforce coordination. Not launched yet - early access open.",
    bullets: [
      "The morning brief in every operative's hand before the first lift.",
      "Workforce and attendance visibility across the day, not at the end of the month.",
      "In build now. Leave an address and we will tell you when it opens.",
    ],
    demo: "showcase",
    share: {
      // TEMPORARY TARGET. instructDABS has no site and instructdabs.com does not
      // resolve, so a shared link or a scanned QR would lead a stranger to a dead
      // address - which is exactly the "it looks ready but isn't" promise the
      // early-access status exists to avoid. Until the domain is live, send people
      // to the product's own early-access page on the hub instead.
      //
      // WHEN instructdabs.com RESOLVES: put the domain back here, in `message`,
      // and set `status` to "live" - the showcase's "Open instructdabs.com" button
      // and the tile's early-access badge both key off `status`.
      message:
        "Keep an eye out for instructDABS — daily activity briefings and site workforce coordination (launching soon): https://instructbrain.com/hub?product=dabs",
      url: "https://instructbrain.com/hub?product=dabs",
      subject: "instructDABS - daily activity briefings (launching soon)",
    },
  },
];

/** The product a `?product=` value names, or `undefined` for anything else. */
export function findHubProduct(value: unknown): HubProduct | undefined {
  if (typeof value !== "string") return undefined;
  const id = HUB_PRODUCT_IDS.find((candidate) => candidate === value);
  return id ? HUB_PRODUCTS.find((product) => product.id === id) : undefined;
}
