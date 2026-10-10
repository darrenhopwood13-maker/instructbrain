import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/** Tailwind's `sm`, where the shell moves its navigation into the header row. */
const HEADER_NAV_BREAKPOINT = 640;

/**
 * `useLayoutEffect` on the client, `useEffect` while server rendering, so a
 * viewport read lands before the browser's first paint without warning in SSR.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * True from Tailwind's `sm` upwards — the width at which the shell shows the
 * navigation in the header rather than the fixed bar at the foot of the screen.
 *
 * The shell asks this so it renders ONE set of navigation links. Its two
 * presentations are mutually exclusive, so hiding one with a breakpoint class
 * only put the same destinations in the document twice: twice the links for a
 * screen reader to walk, twice the controls in the DOM.
 *
 * The state starts `true` to match the server's markup, then the layout effect
 * reads the real viewport before the first paint, so a phone never paints the
 * header links first.
 */
export function useIsWideViewport() {
  const [wide, setWide] = React.useState(true);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(min-width: ${HEADER_NAV_BREAKPOINT}px)`);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return wide;
}
