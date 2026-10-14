/**
 * One short clip per task, with a voice-over and a visible pointer, played inline
 * in the Help sheet. Thirteen tasks, in the order a person actually works: set the
 * directory up, run the report, send it out.
 *
 * The narration is recorded from the same script the clip is filmed to, so the
 * voice and the screen agree. Long-form walkthroughs are deliberately NOT here -
 * they live on the promo page, where a four-megabyte video can stream properly
 * instead of autoplaying in a 64-pixel thumbnail.
 *
 * `clipUrl` is null until real footage exists - the sheet renders "Clip coming
 * soon" rather than blocking on content. Adding footage later is just a URL here,
 * never a code change.
 */
export type HelpTopic = {
  id: string;
  title: string;
  /** One line — what the clip shows, not a tutorial. */
  caption: string;
  clipUrl: string | null;
  /** Set only for a long, narrated piece: opens in its own tab. */
  href?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "directory",
    title: "Set up the project directory",
    caption: "Add the trades, the firms, and who receives what.",
    clipUrl: null,
  },
  {
    id: "start",
    title: "Start a report",
    caption: "Choose how you're working, then a survey type.",
    clipUrl: null,
  },
  {
    id: "capture",
    title: "Capture photos",
    caption: "Take or add photos on site.",
    clipUrl: null,
  },
  {
    id: "review",
    title: "Review findings",
    caption: "Confirm or correct what the AI drafted.",
    clipUrl: null,
  },
  {
    id: "tone",
    title: "Set the tone and language",
    caption: "Pick the register, and the language it goes out in.",
    clipUrl: null,
  },
  {
    id: "allocate",
    title: "Allocate to a trade",
    caption: "Accept the suggested trade, or choose your own.",
    clipUrl: null,
  },
  {
    id: "issue",
    title: "Issue the report",
    caption: "Freeze a version and generate the PDF.",
    clipUrl: null,
  },
  {
    id: "share",
    title: "Share it with a client",
    caption: "Send a link that always serves the issued PDF.",
    clipUrl: null,
  },
  {
    id: "distribute",
    title: "Distribute to trades",
    caption: "Check each extract, then send it yourself.",
    clipUrl: null,
  },
  {
    id: "registers",
    title: "Run a weekly register",
    caption: "Fire, scaffold, welfare and the rest, week by week.",
    clipUrl: null,
  },
  {
    id: "field",
    title: "Capture from the phone",
    caption: "Scan the site QR and work without the dashboard.",
    clipUrl: null,
  },
  {
    id: "hs",
    title: "Health, safety & housekeeping",
    caption: "The site-safety inspection and its own outcomes.",
    clipUrl: null,
  },
  {
    id: "reopen",
    title: "Correct an issued report",
    caption: "Reopen, fix, reissue - the client's link stays as issued.",
    clipUrl: null,
  },
];
