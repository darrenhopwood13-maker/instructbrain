// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadTray, type UploadItem } from "@/components/photos/upload-tray";

const uploaded = (id: string): UploadItem => ({
  id,
  name: `${id}.jpg`,
  sizeLabel: "1.2 MB",
  state: "done",
  progress: 1,
});

describe("compact upload progress", () => {
  it("hides successful file rows until details are requested", () => {
    render(
      <UploadTray
        items={[uploaded("photo-1"), uploaded("photo-2")]}
        overall={1}
        onRetry={vi.fn()}
        onRetryAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("2 photographs uploaded")).toBeTruthy();
    expect(screen.queryByText("photo-1.jpg")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("photo-1.jpg")).toBeTruthy();
  });

  it("shows a failed file and its retry without opening details", () => {
    const onRetry = vi.fn();
    render(
      <UploadTray
        items={[
          uploaded("photo-1"),
          {
            id: "photo-2",
            name: "photo-2.jpg",
            sizeLabel: "1.4 MB",
            state: "error",
            progress: 0,
            error: "Upload interrupted",
          },
        ]}
        overall={0.5}
        onRetry={onRetry}
        onRetryAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("photo-2.jpg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("photo-2");
  });
});