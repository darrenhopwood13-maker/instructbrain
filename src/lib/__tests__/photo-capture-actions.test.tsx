// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoCaptureActions } from "@/components/photos/photo-capture-actions";

/**
 * Which camera a report offers first, and what it says about it.
 *
 * The complaint this guards (Dal, 11 Oct): "why do we have to use the video
 * recorder to take photos in the app anyway?" The in-app camera holds a
 * getUserMedia stream open, which is why it captures at video resolution -
 * 1280x720 against the phone camera's 3072x4080 - and on iOS it can never do
 * better, because Safari has no ImageCapture.takePhoto.
 *
 * So the phone's own camera is the primary action on a report, and the
 * keep-shooting camera is secondary and must state its cost. If someone ever
 * quietly swaps them back, the label assertions here fail.
 */

afterEach(cleanup);

describe("capture actions on a report", () => {
  const noop = () => undefined;

  it("leads with the phone's camera, and says it is full resolution", () => {
    render(<PhotoCaptureActions onCamera={noop} onGallery={noop} />);
    expect(screen.getByRole("button", { name: /take photo/i })).toBeTruthy();
    expect(screen.getByText(/your phone's camera, full resolution/i)).toBeTruthy();
  });

  it("offers the keep-shooting camera only when the browser has one, and names its cost", () => {
    const { unmount } = render(<PhotoCaptureActions onCamera={noop} onGallery={noop} />);
    expect(screen.queryByRole("button", { name: /keep shooting/i })).toBeNull();
    unmount();

    render(<PhotoCaptureActions onCamera={noop} onGallery={noop} onInAppCamera={noop} />);
    expect(screen.getByRole("button", { name: /keep shooting/i })).toBeTruthy();
    // The cost is stated on the button, not hidden in a tooltip or a help page.
    expect(screen.getByText(/stays open, lower resolution/i)).toBeTruthy();
  });

  it("keeps all three routes reachable and wired to their own handler", () => {
    const onCamera = vi.fn();
    const onGallery = vi.fn();
    const onInAppCamera = vi.fn();
    render(
      <PhotoCaptureActions
        onCamera={onCamera}
        onGallery={onGallery}
        onInAppCamera={onInAppCamera}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /take photo/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep shooting/i }));
    fireEvent.click(screen.getByRole("button", { name: /add from albums/i }));

    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(onInAppCamera).toHaveBeenCalledTimes(1);
    expect(onGallery).toHaveBeenCalledTimes(1);
  });

  it("never lets the in-app camera be reached by the label that means the phone camera", () => {
    const onCamera = vi.fn();
    const onInAppCamera = vi.fn();
    render(
      <PhotoCaptureActions onCamera={onCamera} onGallery={noop} onInAppCamera={onInAppCamera} />,
    );
    // "Take photo" must not be a second route to the lower-resolution camera.
    fireEvent.click(screen.getByRole("button", { name: /take photo/i }));
    expect(onInAppCamera).not.toHaveBeenCalled();
    expect(onCamera).toHaveBeenCalledTimes(1);
  });
});
