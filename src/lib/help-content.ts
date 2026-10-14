/**
 * One short, silent, looping clip per task. No narration on a task clip: sound is
 * useless on site, and the Help sheet plays these inline in a thumbnail.
 *
 * The walkthrough is the exception, and is deliberately a link rather than a clip:
 * it is ninety seconds and narrated, so `href` opens it in its own tab. A topic
 * with an `href` is not streamed inside the sheet - a four-megabyte video on
 * autoplay in a 64-pixel box is a data bill on a phone, not help.
 *
 * `clipUrl` is null until real footage exists - the sheet renders "Clip coming
 * soon" rather than blocking on content. Adding a discipline's own clip later is
 * just adding an entry here, never a code change.
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
  {
    id: "walkthrough",
    title: "The whole thing, start to finish",
    caption: "Ninety seconds, narrated: the directory to the subcontractor's extract.",
    clipUrl: null,
    href: "https://darrenhopwood13-maker.github.io/instructbrain-plan/promo-001/IB-WALK-001-directory-to-extract.mp4",
  },
];
