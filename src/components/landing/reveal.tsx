import { useEffect, useRef, useState, type ReactNode } from "react";

/** True once the user has asked the operating system for less motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/** True once the element has entered the viewport at least once. */
export function useInView<T extends HTMLElement>(rootMargin = "-10% 0px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, seen]);

  return { ref, seen } as const;
}

/**
 * Fades and lifts its children into place the first time they scroll into
 * view. Reduced motion renders them immediately, with no transform.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>();
  const visible = reduced || seen;

  return (
    <Tag
      // The three allowed tags all accept a div ref at runtime.
      ref={ref as never}
      className={className}
      style={
        reduced
          ? undefined
          : {
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(18px)",
              transition: "opacity 520ms ease-out, transform 520ms ease-out",
              transitionDelay: `${delayMs}ms`,
            }
      }
    >
      {children}
    </Tag>
  );
}
