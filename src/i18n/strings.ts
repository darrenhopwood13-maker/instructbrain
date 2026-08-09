/**
 * Interface strings that the language toggle translates. English is the
 * record: these values are the source, a translation is only ever a display
 * layer over them.
 */
export const STRINGS = {
  "nav.dashboard": "Dashboard",
  "nav.projects": "Projects",
  "nav.organisation": "Organisation",
  "nav.directory": "Directory",
  "nav.account": "Account",
  "nav.admin": "Admin",
  "action.signIn": "Sign in",
  "action.signOut": "Sign out",
  "action.newReport": "New report",
  "action.quickReport": "Quick report",
  "action.cancel": "Cancel",
  "action.save": "Save",
  "action.revertToEnglish": "Revert to English",
  "report.photos": "Photos",
  "report.review": "Review",
  "report.output": "Output",
  "report.notAssessed": "Not assessed",
  "report.language": "Language",
  "report.translating": "Translating this report",
  "report.translatedNotice":
    "You are reading a translation. The English version remains the record copy.",
} as const;

export type StringKey = keyof typeof STRINGS;
