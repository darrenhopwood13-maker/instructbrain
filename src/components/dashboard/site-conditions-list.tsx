import { Link } from "@tanstack/react-router";
import { AlertTriangle, Wind } from "lucide-react";
import type { SiteConditionRow } from "@/lib/weather/site-conditions.functions";
import {
  WIND_WATCH_FORCE,
  beaufortFromMph,
  beaufortName,
  compassPoint,
  formatMph,
  formatTemperature,
  isWindWatch,
} from "@/lib/weather/units";

/**
 * The wind panel's markup, with no fetching in it, so the wording and the
 * flagged state can be tested by rendering it directly.
 *
 * One line per project: a site manager reads this in five seconds and wants the
 * number, not a weather app.
 */

function updatedLabel(iso: string | null): string {
  if (!iso) return "just now";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "just now";
  return `${parsed.toISOString().slice(11, 16)} UTC`;
}

export function SiteConditionsList({ rows }: { rows: SiteConditionRow[] }) {
  const firstReading = rows.find((row) => row.conditions)?.conditions ?? null;
  const withPostcode = rows.filter((row) => row.state !== "no_postcode");

  return (
    <>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground">
          No projects yet, so there is nothing on site to read.
        </p>
      ) : withPostcode.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground">
          None of your projects carry a postcode on the address, so none of them can be pinned on the map.
          Add a postcode to a project and its wind appears here.
        </p>
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-2">
          {rows.map((row) => {
            const conditions = row.conditions;
            const watch = conditions ? isWindWatch(conditions.windMph) : false;
            const direction = conditions ? compassPoint(conditions.windDirectionDeg) : null;
            const force = conditions ? beaufortFromMph(conditions.windMph) : null;
            return (
              <li
                key={row.projectId}
                className={`flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm ${
                  watch ? "border-fail/30 bg-fail-soft" : "border-border bg-surface-raised"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>

                {conditions ? (
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    {watch ? <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-fail" /> : null}
                    <span className="whitespace-nowrap">
                      <span className="font-semibold">{formatMph(conditions.windMph)}</span>
                      {direction ? ` from the ${direction}` : ""}
                    </span>
                    {conditions.gustMph !== null ? (
                      <span className="whitespace-nowrap text-muted-foreground">
                        gusting {formatMph(conditions.gustMph)}
                      </span>
                    ) : null}
                    <span className="whitespace-nowrap text-muted-foreground">
                      {`Force ${force} - ${beaufortName(force ?? 0)}`}
                    </span>
                    {formatTemperature(conditions.temperatureC) ? (
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatTemperature(conditions.temperatureC)}
                      </span>
                    ) : null}
                    {conditions.symbol ? (
                      <span className="whitespace-nowrap text-muted-foreground">{conditions.symbol}</span>
                    ) : null}
                  </span>
                ) : row.state === "no_postcode" ? (
                  <Link
                    to="/projects/$id"
                    params={{ id: row.projectId }}
                    className="shrink-0 text-xs font-semibold text-brand-accent-ink"
                  >
                    Add a postcode to see this one
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">{row.reason ?? "Not available"}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {withPostcode.length > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {`Forecast from ${firstReading?.providerName ?? "the weather service"}, updated ${updatedLabel(
            firstReading?.observedAt ?? null,
          )}. Flagged from Force ${WIND_WATCH_FORCE} (25 mph): when sheeted scaffold and most lifting start needing planned hold points - a conversation flag, not a rule.`}
        </p>
      ) : null}
    </>
  );
}

export function SiteConditionsHeading() {
  return (
    <h2
      id="site-conditions-heading"
      className="editorial-title flex flex-wrap items-center gap-2 text-base font-semibold"
    >
      <Wind aria-hidden="true" className="size-4 shrink-0 text-brand-blue" />
      Wind on site
    </h2>
  );
}
