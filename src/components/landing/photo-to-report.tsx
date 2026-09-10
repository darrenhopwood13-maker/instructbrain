import { useEffect, useState } from "react";
import { Reveal, useInView, usePrefersReducedMotion } from "@/components/landing/reveal";

/**
 * A four-beat demonstration of the pipeline: photographs land, the analysis
 * pass runs, referenced findings appear, the document is issued.
 *
 * Presentation only — no data, no network. Motion pauses out of view and is
 * replaced by the finished state entirely under reduced motion.
 */
const STAGES = [
  { key: "upload", label: "Photos uploaded", note: "Full-resolution originals kept" },
  { key: "scan", label: "Analysis running", note: "Read against the report template" },
  { key: "findings", label: "Findings drafted", note: "Referenced, scored, trade suggested" },
  { key: "issued", label: "Report issued", note: "PDF, contents page, per-trade extracts" },
] as const;

const FINDINGS = [
  { ref: "F-001", text: "Sealant failure to parapet upstand", status: "fail" as const },
  { ref: "F-002", text: "Ponding to flat roof outlet", status: "warn" as const },
  { ref: "F-003", text: "Obscured — light too poor to judge", status: "not_assessed" as const },
  { ref: "F-004", text: "Cavity tray correctly lapped", status: "pass" as const },
];

const STATUS_LABEL: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  warn: "Warn",
  not_assessed: "Not assessed",
};

const STATUS_CLASS: Record<string, string> = {
  pass: "border-pass/40 bg-pass-soft text-pass",
  fail: "border-fail/40 bg-fail-soft text-fail",
  warn: "border-warn/40 bg-warn-soft text-warn",
  not_assessed: "border-flag/40 bg-flag-soft text-flag",
};

const STAGE_MS = 2200;

export function PhotoToReport() {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>("0px");
  const [stage, setStage] = useState(reduced ? STAGES.length - 1 : 0);

  useEffect(() => {
    if (reduced || !seen) return;
    const timer = window.setInterval(() => {
      setStage((current) => (current + 1) % STAGES.length);
    }, STAGE_MS);
    return () => window.clearInterval(timer);
  }, [reduced, seen]);

  const active = STAGES[reduced ? STAGES.length - 1 : stage]!;
  const showScan = !reduced && stage === 1;
  const showFindings = reduced || stage >= 2;
  const showDocument = reduced || stage === 3;

  return (
    <div ref={ref} className="glass-panel overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Photos in, report out</p>
        <p aria-live="polite" className="text-xs font-semibold text-foreground">
          {active.label}
          <span className="ml-2 font-normal text-muted-foreground">{active.note}</span>
        </p>
      </div>

      {/* Photo strip with the analysis pass */}
      <div className="relative mt-5 overflow-hidden rounded-xl border border-border bg-surface-sunken p-3">
        <ul className="flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <li
              key={index}
              className="h-14 flex-1 rounded-md border border-border bg-brand-blue-soft sm:h-16"
              style={
                reduced
                  ? undefined
                  : {
                      opacity: seen ? 1 : 0,
                      transform: seen ? "none" : "translateY(-10px)",
                      transition: "opacity 420ms ease-out, transform 420ms ease-out",
                      transitionDelay: `${index * 90}ms`,
                    }
              }
            >
              <span className="sr-only">Site photograph {index + 1}</span>
            </li>
          ))}
        </ul>

        {showScan ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-16 bg-brand-accent/25"
            style={{ animation: "ib-scan 2.2s linear infinite" }}
          />
        ) : null}
      </div>

      {/* Drafted findings */}
      <ul className="mt-4 space-y-2">
        {FINDINGS.map((finding, index) => (
          <li
            key={finding.ref}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
            style={
              reduced
                ? undefined
                : {
                    opacity: showFindings ? 1 : 0,
                    transform: showFindings ? "none" : "translateY(10px)",
                    transition: "opacity 380ms ease-out, transform 380ms ease-out",
                    transitionDelay: `${index * 110}ms`,
                  }
            }
          >
            <span className="text-xs font-bold tabular-nums text-brand-accent-ink">
              {finding.ref}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm">
              {finding.text}
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${
                STATUS_CLASS[finding.status]
              }`}
            >
              {STATUS_LABEL[finding.status]}
            </span>
          </li>
        ))}
      </ul>

      {/* The issued document */}
      <div
        className="mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-brand-accent/60 bg-brand-accent-soft px-4 py-3"
        style={
          reduced
            ? undefined
            : {
                opacity: showDocument ? 1 : 0.35,
                transform: showDocument ? "none" : "translateY(8px)",
                transition: "opacity 420ms ease-out, transform 420ms ease-out",
              }
        }
      >
        <span className="text-sm font-bold text-foreground">Issued PDF — 4 findings</span>
        <span className="text-xs font-semibold text-brand-accent-ink">
          Contents page · per-trade extracts
        </span>
      </div>
    </div>
  );
}

/** The weekly register ticking through its six ordered checks. */
const CHECKS = [
  "Fire",
  "Excavation",
  "Scaffold",
  "Welfare",
  "Lifting and plant",
  "Housekeeping",
] as const;

export function ComplianceTicker() {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>("0px");
  const [step, setStep] = useState(reduced ? CHECKS.length : 0);

  useEffect(() => {
    if (reduced || !seen) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current >= CHECKS.length ? 0 : current + 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [reduced, seen]);

  return (
    <Reveal>
      <div ref={ref} className="glass-panel rounded-2xl p-5 sm:p-6">
        <p className="eyebrow">Weekly compliance register</p>
        <ul className="mt-4 space-y-2">
          {CHECKS.map((check, index) => {
            const done = reduced || index < step;
            // The scaffold check is the worked example of a raised action.
            const nonCompliant = index === 2;
            return (
              <li
                key={check}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
                style={reduced ? undefined : { opacity: done ? 1 : 0.4, transition: "opacity 300ms ease-out" }}
              >
                <span className="font-semibold text-foreground">
                  {index + 1}. {check}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${
                    done
                      ? nonCompliant
                        ? STATUS_CLASS.fail
                        : STATUS_CLASS.pass
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? (nonCompliant ? "Non-compliant" : "Compliant") : "Awaiting"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          One non-compliant check raises an action with an owner and a due date. The run locks when
          it is completed, and the last six weeks stay side by side.
        </p>
      </div>
    </Reveal>
  );
}
