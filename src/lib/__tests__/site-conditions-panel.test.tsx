// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { SiteConditionsList } from "@/components/dashboard/site-conditions-list";
import type { SiteConditionRow } from "@/lib/weather/site-conditions.functions";

/**
 * What the wind panel actually says on screen.
 *
 * The assertions read the row's text, because that is the only place a site
 * manager sees it. Two things are being guarded here beyond layout: a reading
 * with NO gust must never claim one, and a calm-ish day must not carry the
 * flagged treatment.
 *
 * Link is stubbed: these assertions are about the wording of the prompt to add
 * a postcode, not about routing, and no other component test in this repo
 * renders inside a router.
 */
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#project">{children}</a>,
}));

const conditions = (over: Partial<NonNullable<SiteConditionRow["conditions"]>> = {}) => ({
  observedAt: "2026-10-11T12:00:00Z",
  windMph: 22,
  windDirectionDeg: 234,
  gustMph: null,
  temperatureC: 14.6,
  humidityPercent: 71,
  cloudPercent: 61,
  symbol: "Partly cloudy",
  provider: "metno" as const,
  providerName: "MET Norway",
  providerUrl: "https://www.met.no/en/free-meteorological-data",
  resolutionNote: "about a 9 km grid",
  ...over,
});

const row = (over: Partial<SiteConditionRow> = {}): SiteConditionRow => ({
  projectId: "p1",
  name: "Priory Church",
  address: "Priory Church, Christchurch BH23 1AF",
  locationLabel: "BH23 1AF",
  locationPrecision: "postcode",
  state: "ok",
  reason: null,
  conditions: conditions(),
  ...over,
});

describe("wind panel", () => {
  it("reads a project as a number, a direction and a force", () => {
    const { container } = render(<SiteConditionsList rows={[row()]} />);
    const text = container.querySelector("li")?.textContent ?? "";
    expect(text).toContain("Priory Church");
    expect(text).toContain("22 mph from the SW");
    expect(text).toContain("Force 5 - Fresh breeze");
    expect(text).toContain("15°C");
    expect(text).toContain("Partly cloudy");
  });

  it("never claims a gust that the provider did not give", () => {
    const { container } = render(<SiteConditionsList rows={[row()]} />);
    expect(container.querySelector("li")?.textContent).not.toContain("gusting");
  });

  it("shows the gust when there is one", () => {
    const { container } = render(
      <SiteConditionsList rows={[row({ conditions: conditions({ windMph: 34, gustMph: 41 }) })]} />,
    );
    expect(container.querySelector("li")?.textContent).toContain("34 mph from the SW");
    expect(container.querySelector("li")?.textContent).toContain("gusting 41 mph");
    expect(container.querySelector("li")?.textContent).toContain("Force 7 - Near gale");
  });

  it("flags the row at Force 6 and leaves Force 5 alone", () => {
    const { container } = render(
      <SiteConditionsList
        rows={[row(), row({ projectId: "p2", name: "Depot", conditions: conditions({ windMph: 26 }) })]}
      />,
    );
    const [calm, strong] = Array.from(container.querySelectorAll("li"));
    expect(calm!.className).not.toContain("border-fail/30");
    expect(strong!.className).toContain("border-fail/30");
    // The flag is a warning icon plus the forced row treatment, not a word.
    expect(strong!.querySelector("svg")).not.toBeNull();
  });

  it("asks that one project for a postcode instead of guessing a location", () => {
    // Mixed list, which is the real case: most projects pinned, one not.
    const { container } = render(
      <SiteConditionsList
        rows={[
          row(),
          row({
            projectId: "p2",
            name: "Riverside Depot",
            state: "no_postcode",
            conditions: null,
            reason: "No usable postcode on this project's address.",
          }),
        ]}
      />,
    );
    const unpinned = Array.from(container.querySelectorAll("li"))[1];
    expect(unpinned?.textContent).toContain("Riverside Depot");
    expect(unpinned?.textContent).toContain("Add a postcode to see this one");
    expect(unpinned?.textContent).not.toContain("mph");
  });

  it("says why a project has no reading rather than showing a zero", () => {
    const { container } = render(
      <SiteConditionsList
        rows={[row({ state: "unavailable", conditions: null, reason: "The forecast service could not be reached (503)." })]}
      />,
    );
    expect(container.querySelector("li")?.textContent).toContain("could not be reached (503)");
  });

  it("carries the source, the time and the flag threshold under the list", () => {
    const { container } = render(<SiteConditionsList rows={[row()]} />);
    const footer = container.querySelector("p")?.textContent ?? "";
    expect(footer).toContain("Forecast from MET Norway");
    expect(footer).toContain("12:00 UTC");
    expect(footer).toContain("Flagged from Force 6 (25 mph)");
    expect(footer).toContain("not a rule");
  });

  it("says plainly when no project can be pinned, instead of showing an empty list", () => {
    const { container } = render(<SiteConditionsList rows={[row({ state: "no_postcode", conditions: null })]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("None of your projects carry a postcode");
  });

  it("says there is nothing on site when there are no projects", () => {
    const { container } = render(<SiteConditionsList rows={[]} />);
    expect(container.textContent).toContain("No projects yet");
  });
});
