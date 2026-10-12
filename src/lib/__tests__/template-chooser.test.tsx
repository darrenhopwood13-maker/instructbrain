// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TemplateChooser } from "@/components/report/template-chooser";
import { LAST_BRIEF_KEY, lastUsedTemplateId } from "@/lib/report/last-template";
import { templateGroups } from "@/lib/report/template-families";
import { systemDefinitions } from "@/lib/survey-definitions";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const groups = templateGroups();

function renderChooser(selectedId: string | null = null, lastUsedId: string | null = null) {
  const onSelect = vi.fn();
  const onUse = vi.fn();
  render(
    <TemplateChooser
      groups={groups}
      selectedId={selectedId}
      lastUsedId={lastUsedId}
      onSelect={onSelect}
      onUse={onUse}
    />,
  );
  return { onSelect, onUse };
}

describe("choosing a report on a working screen", () => {
  it("shows every template, grouped under one heading each", () => {
    renderChooser();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual([
      "Snagging & handover",
      "Condition & fabric",
      "Site & safety",
      "M&E",
      "Records & registers",
    ]);
    for (const definition of systemDefinitions) {
      expect(screen.getByText(definition.label), definition.id).toBeTruthy();
    }
  });

  it("explains each template rather than showing a name on its own", () => {
    renderChooser();
    expect(
      screen.getByText(
        "Condition of each element, room by room, on a four-step grade. Records, does not ask for a fix.",
      ),
    ).toBeTruthy();
  });

  it("marks the chosen template and reports it to the caller", () => {
    const { onSelect } = renderChooser();
    const row = screen.getByRole("button", { name: /Weatherproofing membrane survey/ });
    expect(row.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("weatherproofing");
  });

  it("cannot be used until something is chosen - and says so", () => {
    const { onUse } = renderChooser(null);
    expect(screen.getByText("Nothing chosen yet")).toBeTruthy();
    const use = screen.getByRole("button", { name: "Use this template" });
    expect(use.hasAttribute("disabled")).toBe(true);
    fireEvent.click(use);
    expect(onUse).not.toHaveBeenCalled();
  });

  it("hands the chosen template on, with the name in the footer", () => {
    const { onUse } = renderChooser("electrical_installation");
    expect(screen.getByTestId("chosen-template").textContent).toBe("Electrical installation condition");
    const use = screen.getByRole("button", { name: "Use this template" });
    expect(use.hasAttribute("disabled")).toBe(false);
    fireEvent.click(use);
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it("pins the last used template, and offers it as the way in", () => {
    const { onSelect } = renderChooser(null, "snagging");
    expect(screen.getByText("Last used")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Last used/ }));
    expect(onSelect).toHaveBeenCalledWith("snagging");
  });

  it("pins nothing when this device has not started a report", () => {
    renderChooser();
    expect(screen.queryByText("Last used")).toBeNull();
  });
});

describe("remembering the last template", () => {
  it("returns the template from the stored brief", () => {
    window.localStorage.setItem(LAST_BRIEF_KEY, JSON.stringify({ templateId: "site_walk" }));
    expect(lastUsedTemplateId(["site_walk", "snagging"])).toBe("site_walk");
  });

  it("ignores an id the registry no longer has, rather than pinning a dead template", () => {
    window.localStorage.setItem(LAST_BRIEF_KEY, JSON.stringify({ templateId: "retired_template" }));
    expect(lastUsedTemplateId(["site_walk"])).toBeNull();
  });

  it("survives a corrupt store instead of throwing on the way in", () => {
    window.localStorage.setItem(LAST_BRIEF_KEY, "{not json");
    expect(lastUsedTemplateId(["site_walk"])).toBeNull();
  });
});
