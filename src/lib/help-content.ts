/**
 * One short, silent, looping clip per task. No narration: sound is useless on
 * site. `clipUrl` is null until real footage exists — the Help sheet renders
 * a placeholder rather than blocking on content. Adding a discipline's own
 * clip later is just adding an entry here, never a code change.
 */
export type HelpTopic = {
  id: string;
  title: string;
  /** One line — what the clip shows, not a tutorial. */
  caption: string;
  clipUrl: string | null;
};

export const HELP_TOPICS: HelpTopic[] = [
  { id: "start", title: "Start a report", caption: "Choose how you're working, then a survey type.", clipUrl: null },
  { id: "capture", title: "Capture photos", caption: "Take or add photos on site.", clipUrl: null },
  { id: "review", title: "Review findings", caption: "Confirm or correct what the AI drafted.", clipUrl: null },
  { id: "issue", title: "Issue the report", caption: "Freeze a version and generate the PDF.", clipUrl: null },
  { id: "distribute", title: "Distribute to trades", caption: "Check each extract, then send it yourself.", clipUrl: null },
];
