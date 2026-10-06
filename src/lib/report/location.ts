/**
 * Where a finding is — resolved one way, everywhere.
 *
 * Four places used to answer "where is this?" four different ways, so the same
 * finding could show a different location on the review card, in the by-area
 * schedule, in the PDF and on the shared page:
 *
 *   - the review list joined EVERY capture field value together, so the
 *     "location" line read as a list of everything anyone had typed;
 *   - the by-area grouping took whichever field happened to come first in the
 *     object, which is not a location model at all;
 *   - the PDF header read location, then zone, then area, then room;
 *   - the shared page had no location line at all — it printed the capture
 *     fields as ordinary details, with the location hiding among them.
 *
 * This module is the one answer they all use now.
 *
 * Note what is NOT here. A report form asking two questions that both read as
 * "where?" is what made this visible: `location` (free text) and `area_type`
 * (a list of space types) sat next to each other. But `area_type` describes the
 * KIND of space — internal, external, welfare — not a position within it, so
 * collapsing the two would have thrown away a useful detail in order to fix a
 * labelling problem. It stays a detail field; the fix was to stop calling it
 * something that reads as a location.
 */

/**
 * The capture-field ids that answer "where", in the order the renderers already
 * agreed on. No survey definition declares more than one of these, so the
 * relative order of the secondary ids cannot change any existing output — it
 * only decides between two answers nobody has ever given at once.
 *
 * `location` and `room` are the two a definition actually declares: `location`
 * on the surveys, `room` on the property inventory. `zone`, `area` and `level`
 * are the secondary spellings the older renderers already read.
 */
export const LOCATION_FIELD_IDS = ["location", "zone", "area", "room", "level"] as const;

/** One membership test, so no renderer keeps its own copy of that list. */
export const LOCATION_FIELD_SET: ReadonlySet<string> = new Set<string>(LOCATION_FIELD_IDS);

/** Said plainly rather than left blank, matching the document's own wording. */
export const LOCATION_NOT_RECORDED = "Location not recorded";

/** The location, or an empty string when nothing recorded one. */
export function resolveLocation(fields: Record<string, string> | null | undefined): string {
  if (!fields) return "";
  for (const id of LOCATION_FIELD_IDS) {
    const value = fields[id];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

/** The location as it should be shown, never blank. */
export function locationLabel(fields: Record<string, string> | null | undefined): string {
  return resolveLocation(fields) || LOCATION_NOT_RECORDED;
}
