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
 * Every topic carries its clip. The files are served from the public hub page the
 * promo and the walkthrough already live on, so the sheet streams the same cut the
 * page does - one source, no second copy to drift.
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

/** Where the clips are served from. */
export const HELP_CLIP_BASE =
  "https://darrenhopwood13-maker.github.io/instructbrain-plan/help/";

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "directory",
    title: "Set up the project directory",
    caption: "Add the trades, the firms, and who receives what.",
    clipUrl: `${HELP_CLIP_BASE}01-set-up-the-project-directory.mp4`,
  },
  {
    id: "start",
    title: "Start a report",
    caption: "Choose how you're working, then a survey type.",
    clipUrl: `${HELP_CLIP_BASE}02-start-a-report.mp4`,
  },
  {
    id: "capture",
    title: "Capture photos",
    caption: "Take or add photos on site.",
    clipUrl: `${HELP_CLIP_BASE}03-capture-photos.mp4`,
  },
  {
    id: "review",
    title: "Review findings",
    caption: "Confirm or correct what the AI drafted.",
    clipUrl: `${HELP_CLIP_BASE}04-review-findings.mp4`,
  },
  {
    id: "tone",
    title: "Set the tone and language",
    caption: "Pick the register, and the language it goes out in.",
    clipUrl: `${HELP_CLIP_BASE}05-set-the-tone-and-language.mp4`,
  },
  {
    id: "allocate",
    title: "Allocate to a trade",
    caption: "Accept the suggested trade, or choose your own.",
    clipUrl: `${HELP_CLIP_BASE}06-allocate-to-a-trade.mp4`,
  },
  {
    id: "issue",
    title: "Issue the report",
    caption: "Freeze a version and generate the PDF.",
    clipUrl: `${HELP_CLIP_BASE}07-issue-the-report.mp4`,
  },
  {
    id: "share",
    title: "Share it with a client",
    caption: "Send a link that always serves the issued PDF.",
    clipUrl: `${HELP_CLIP_BASE}08-share-it-with-a-client.mp4`,
  },
  {
    id: "distribute",
    title: "Distribute to trades",
    caption: "Check each extract, then send it yourself.",
    clipUrl: `${HELP_CLIP_BASE}09-distribute-to-trades.mp4`,
  },
  {
    id: "registers",
    title: "Run a weekly register",
    caption: "Fire, scaffold, welfare and the rest, week by week.",
    clipUrl: `${HELP_CLIP_BASE}10-run-a-weekly-register.mp4`,
  },
  {
    id: "field",
    title: "Capture from the phone",
    caption: "Scan the site QR and work without the dashboard.",
    clipUrl: `${HELP_CLIP_BASE}11-capture-from-the-phone.mp4`,
  },
  {
    id: "hs",
    title: "Health, safety & housekeeping",
    caption: "The site-safety inspection and its own outcomes.",
    clipUrl: `${HELP_CLIP_BASE}12-health-safety-and-housekeeping.mp4`,
  },
  {
    id: "reopen",
    title: "Correct an issued report",
    caption: "Reopen, fix, reissue - the client's link stays as issued.",
    clipUrl: `${HELP_CLIP_BASE}13-correct-an-issued-report.mp4`,
  },
];
