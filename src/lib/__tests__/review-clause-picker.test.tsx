// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ReviewList } from "@/components/review-list";
import { CLAUSE_SETS } from "@/lib/regulatory-clauses";
import { electricalInstallationDefinition, snapshotOf } from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";
import type { Finding } from "@/lib/types";

/**
 * The clause control on the review screen.
 *
 * Three things have to hold, and each is asserted against what renders:
 *
 *   1. It offers that instrument's own published list, and nothing else. There is no free text
 *      and no second source - a person picks a line or picks none.
 *   2. It appears only where it can mean something: a finding that already names an instrument
 *      whose publisher titles its own units. An instrument whose list is bare numbers offers
 *      nothing, and a finding that names no instrument offers nothing.
 *   3. The report's own switch governs it. With references off the control is not rendered at
 *      all - and nothing is deleted by that, because it comes back when the switch does.
 */

// Radix drives the select through pointer capture and layout APIs jsdom does not implement.
beforeEach(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto["hasPointerCapture"] = () => false;
  proto["setPointerCapture"] = () => {};
  proto["releasePointerCapture"] = () => {};
  proto["scrollIntoView"] = () => {};
});

afterEach(cleanup);

const ELECTRICAL = snapshotOf(electricalInstallationDefinition) as SurveyTypeSnapshot;

const REFERENCE = "eawr_1989";
/** An instrument that offers a list. */
const OFFERS = CLAUSE_SETS.eawr_1989.entries;
/** An instrument on the same template that offers none: BS 7671 titles nothing. */
const BARE = "bs_7671";

const asFinding = (id: string, ref: string, options: Partial<Finding> = {}): Finding =>
  ({
    id,
    ref,
    title: `Item ${ref}`,
    location: "L1",
    trade: "Trade not assigned",
    status: "installation_defect",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: [],
    note: "",
    description: `Observed condition at ${ref}.`,
    remedial: "",
    likelyCause: null,
    likelyCauseConfirmed: false,
    ...options,
  }) as unknown as Finding;

const renderList = (findings: Finding[], options: { regulationsEnabled?: boolean; onAssignClause?: (id: string, clause: string | null) => Promise<void> } = {}) => {
  const onAssignClause = options.onAssignClause ?? vi.fn(async () => {});
  render(
    <ReviewList
      snapshot={ELECTRICAL}
      findings={findings}
      regulationsEnabled={options.regulationsEnabled ?? true}
      onAssignClause={onAssignClause}
    />,
  );
  return { onAssignClause };
};

/** Open the clause dialog for one finding, then its list of choices. */
const openClauseChoices = (ref: string) => {
  fireEvent.click(screen.getByRole("button", { name: `Open clause for ${ref}` }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("combobox", { name: `Clause for ${ref}` }));
  return dialog;
};

describe("the clause picker offers the instrument's own list", () => {
  it("lists every entry the instrument publishes, and nothing from anywhere else", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: REFERENCE })]);
    openClauseChoices("F-001");

    const options = screen.getAllByRole("option").map((option) => option.textContent ?? "");
    // The list is the instrument's own, in its own order, plus the one way to choose none.
    expect(options).toHaveLength(OFFERS.length + 1);
    expect(options[0]).toBe("No clause");
    expect(options.slice(1)).toEqual(OFFERS.map((entry) => `${entry.number} — ${entry.heading}`));

    // Nothing from a neighbouring instrument's list, and nothing invented.
    expect(options.some((option) => option.startsWith("SCHEDULE 5 —"))).toBe(false);
    expect(options.some((option) => option.includes("(18th Edition)"))).toBe(false);
  });

  it("offers no way to type a clause: the only control is the list", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: REFERENCE })]);
    // The dialog first: nothing in it accepts typed text, and the single control is the list.
    fireEvent.click(screen.getByRole("button", { name: "Open clause for F-001" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(within(dialog).getAllByRole("combobox")).toHaveLength(1);

    // With the list open there is still no text box, and every option is a line from the
    // instrument's own list - or the single way to choose none.
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Clause for F-001" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    const offered = new Set(OFFERS.map((entry) => `${entry.number} — ${entry.heading}`));
    const shown = screen.getAllByRole("option").map((option) => option.textContent ?? "");
    expect(shown).toHaveLength(OFFERS.length + 1);
    for (const option of shown) {
      if (option === "No clause") continue;
      expect(offered.has(option), `${option} is not on the instrument's list`).toBe(true);
    }
  });

  it("writes the number the person chose, and only that number", async () => {
    const { onAssignClause } = renderList([
      asFinding("a", "F-001", { regulatoryReference: REFERENCE }),
    ]);
    openClauseChoices("F-001");

    const chosen = OFFERS.find((entry) => entry.number === "4")!;
    fireEvent.click(screen.getByRole("option", { name: `${chosen.number} — ${chosen.heading}` }));

    await waitFor(() => expect(onAssignClause).toHaveBeenCalledTimes(1));
    expect(onAssignClause).toHaveBeenCalledWith("a", "4");
  });

  it("shows the chosen clause back exactly as the report prints it", () => {
    renderList([
      asFinding("a", "F-001", { regulatoryReference: REFERENCE, regulatoryClause: "4" }),
    ]);
    const heading = OFFERS.find((entry) => entry.number === "4")!.heading;
    expect(
      screen.getByText(`Electricity at Work Regulations 1989, regulation 4 - ${heading}`),
    ).toBeTruthy();
    expect(screen.getByText("Chosen by reviewer")).toBeTruthy();
  });

  it("never offers the assessment's opinion: a clause is a person's choice only", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: REFERENCE })]);
    const text = document.body.textContent ?? "";
    expect(text).toContain("No clause chosen");
    // The wording that marks an AI suggestion must never appear on a clause, unlike the
    // reference beside it - there is no machine value for a clause at all.
    const card = screen.getByRole("button", { name: "Open clause for F-001" }).closest("section")!;
    expect(card.textContent ?? "").not.toContain("AI suggestion");
  });
});

describe("the clause picker appears only where it can mean something", () => {
  it("does not appear for an instrument whose publisher titles no paragraph", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: BARE })]);
    expect(screen.getByRole("button", { name: "Open regulatory reference" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
  });

  it("does not appear when the finding names no instrument at all", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: null })]);
    expect(screen.getByRole("button", { name: "Open regulatory reference" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
  });

  it("does not appear when no reference field is declared for the report at all", () => {
    renderList([asFinding("a", "F-001", { regulatoryReference: REFERENCE })], {
      regulationsEnabled: false,
    });
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open regulatory reference" })).toBeNull();
  });

  it("shows each finding its own instrument's list, and none where there is none", () => {
    renderList([
      asFinding("a", "F-001", { regulatoryReference: REFERENCE }),
      asFinding("b", "F-002", { regulatoryReference: BARE }),
    ]);
    // The screen shows one finding at a time. The first names an instrument with a list.
    expect(screen.getAllByRole("button", { name: "Open clause for F-001" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Open clause for F-002" })).toBeNull();

    // Moving to the second finding: it names an instrument whose list is bare numbers, so the
    // clause control is not there - and the reference control above it still is.
    fireEvent.click(screen.getByRole("button", { name: /^Open Item 2:/ }));
    expect(screen.queryByRole("button", { name: "Open clause for F-002" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open regulatory reference" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
  });
});

describe("the switch hides the clause picker and deletes nothing", () => {
  it("renders no clause control with references off, and renders it again with them on", () => {
    const item = asFinding("a", "F-001", {
      regulatoryReference: REFERENCE,
      regulatoryClause: "4",
    });
    const heading = OFFERS.find((entry) => entry.number === "4")!.heading;
    const printed = `Electricity at Work Regulations 1989, regulation 4 - ${heading}`;

    const { unmount } = render(
      <ReviewList snapshot={ELECTRICAL} findings={[item]} regulationsEnabled={false} onAssignClause={vi.fn(async () => {})} />,
    );
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
    // Hidden, not shown greyed: there is no clause line anywhere on the screen.
    expect(document.body.textContent ?? "").not.toContain(printed);
    // And the finding still carries it. Nothing was deleted by switching off.
    expect(item.regulatoryClause).toBe("4");
    unmount();

    render(
      <ReviewList snapshot={ELECTRICAL} findings={[item]} regulationsEnabled onAssignClause={vi.fn(async () => {})} />,
    );
    expect(screen.getByRole("button", { name: "Open clause for F-001" })).toBeTruthy();
    expect(screen.getByText(printed)).toBeTruthy();
  });

  it("keeps the clause when the report is opened without a writer at all", () => {
    const item = asFinding("a", "F-001", {
      regulatoryReference: REFERENCE,
      regulatoryClause: "4",
    });
    render(<ReviewList snapshot={ELECTRICAL} findings={[item]} />);
    // A read-only render simply does not offer the control; the value is untouched.
    expect(screen.queryByRole("button", { name: "Open clause for F-001" })).toBeNull();
    expect(item.regulatoryClause).toBe("4");
  });
});
