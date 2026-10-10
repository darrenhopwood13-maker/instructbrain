// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadTray, type UploadItem } from "@/components/photos/upload-tray";

afterEach(cleanup);

const uploaded = (id: string): UploadItem => ({
  id,
  name: `${id}.jpg`,
  sizeLabel: "1.2 MB",
  state: "done",
  progress: 1,
});

const failed = (id: string): UploadItem => ({
  id,
  name: `${id}.jpg`,
  sizeLabel: "1.4 MB",
  state: "error",
  progress: 0,
  error: "Upload interrupted",
});

describe("compact upload progress", () => {
  it("is a bar and a count, and nothing else while it is going well", () => {
    render(
      <UploadTray
        items={[uploaded("photo-1"), uploaded("photo-2")]}
        overall={1}
        onRetry={vi.fn()}
        onRetryAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("2/2")).toBeTruthy();
    // No heading, no per-file rows, nothing to open.
    expect(screen.queryByText("photo-1.jpg")).toBeNull();
    expect(screen.queryByText(/uploaded$/)).toBeNull();
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
  });

  it("counts only what has landed, so a batch mid-flight reads honestly", () => {
    render(
      <UploadTray
        items={[
          uploaded("photo-1"),
          { id: "photo-2", name: "photo-2.jpg", sizeLabel: "1.1 MB", state: "running", progress: 0.4 },
        ]}
        overall={0.7}
        onRetry={vi.fn()}
        onRetryAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("keeps a failure visible, with words and a retry", () => {
    const onRetry = vi.fn();
    render(
      <UploadTray
        items={[uploaded("photo-1"), failed("photo-2")]}
        overall={0.5}
        onRetry={onRetry}
        onRetryAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 of 2 did not reach storage/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry it" }));
    expect(onRetry).toHaveBeenCalledWith("photo-2");
  });

  it("retries the whole failed set when more than one is down", () => {
    const onRetryAll = vi.fn();
    render(
      <UploadTray
        items={[failed("photo-1"), failed("photo-2"), uploaded("photo-3")]}
        overall={0.33}
        onRetry={vi.fn()}
        onRetryAll={onRetryAll}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry 2" }));
    expect(onRetryAll).toHaveBeenCalled();
  });

  it("offers Clear once nothing is in flight", () => {
    const onDismiss = vi.fn();
    render(
      <UploadTray
        items={[uploaded("photo-1")]}
        overall={1}
        onRetry={vi.fn()}
        onRetryAll={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
