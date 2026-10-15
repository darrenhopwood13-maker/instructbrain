// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { FieldCard } from "@/components/field-card";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * A dialog may not be widened by its own content.
 *
 * The lesson, measured on the live app on 15 October 2026: a field card holding
 * a chosen instrument - "Electricity at Work Regulations 1989" - was 425px wide
 * inside a 268px dialog. The dialog's `grid` had one implicit `auto` column, the
 * Select's value was `white-space: nowrap` with the flex default `min-width:
 * auto`, and between them the column grew to the width of the longest label.
 * The card, its title and its description all hung off the right-hand edge of
 * the screen with nothing to scroll, which is what Dal reported as "Screen
 * Layout large and frozen" (and a screenshot of a card whose text ran off the
 * side). The 53 other Select triggers in the app had the same weakness.
 *
 * jsdom has no layout engine, so this cannot measure widths. It is a tripwire
 * for the two classes that hold the behaviour in place; the measurement itself
 * was made in a real browser against these very screens.
 */
describe("an overlay cannot be widened by what it holds", () => {
  it("gives a field card's dialog a single column that cannot outgrow it", () => {
    render(
      <FieldCard label="Regulatory reference" open onOpenChange={() => {}}>
        <p>Electricity at Work Regulations 1989</p>
      </FieldCard>,
    );
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.className).toContain("grid-cols-[minmax(0,1fr)]");
  });

  it("lets a chosen value shrink instead of setting the width of its box", () => {
    render(
      <Select value="eawr_1989">
        <SelectTrigger aria-label="Regulatory reference">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    );
    const trigger = document.querySelector('[aria-label="Regulatory reference"]');
    expect(trigger).not.toBeNull();
    // The value span is a flex item, so it needs its own permission to shrink.
    expect(trigger!.className).toContain("[&>span]:min-w-0");
  });
});
