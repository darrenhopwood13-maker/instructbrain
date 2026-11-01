// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FieldSyncPill } from "@/components/field/field-sync-pill";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  cleanup();
});

function offline() {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
}

function online() {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
}

describe("FieldSyncPill", () => {
  it("says all synced when nothing is waiting", () => {
    online();
    render(<FieldSyncPill uploaded={4} pending={0} failed={0} />);
    expect(screen.getByText("All synced")).toBeTruthy();
    expect(screen.getByText("4 photos saved")).toBeTruthy();
  });

  it("shows an upload in flight", () => {
    online();
    render(<FieldSyncPill uploaded={1} pending={2} failed={0} />);
    expect(screen.getByText("Uploading 2")).toBeTruthy();
  });

  it("says queued rather than uploading when the device has no signal", () => {
    offline();
    render(<FieldSyncPill uploaded={1} pending={3} failed={0} />);
    expect(screen.getByText("3 queued — no signal")).toBeTruthy();
    expect(screen.queryByText(/Uploading/)).toBeNull();
  });

  it("puts a failure on screen instead of silently losing a photograph", () => {
    online();
    render(<FieldSyncPill uploaded={1} pending={0} failed={2} onRetry={() => {}} />);
    expect(screen.getByText("2 photos did not upload")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    // A failure must not be dressed up as synced.
    expect(screen.queryByText("All synced")).toBeNull();
  });

  it("retries when the button is pressed", () => {
    online();
    const retry = vi.fn();
    render(<FieldSyncPill uploaded={0} pending={0} failed={1} onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry when the caller has nothing to retry with", () => {
    online();
    render(<FieldSyncPill uploaded={0} pending={0} failed={1} />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
