import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Live ROI model. Presentation only — no data, no network, no business logic.
 *
 * Assumptions are stated on screen so a buyer can argue with them:
 *   write-up by hand ≈ 1 hour per 8 photographs
 *   Report Ready    ≈ 4 minutes per survey
 */
const PHOTOS_PER_MANUAL_HOUR = 8;
const APP_MINUTES_PER_SURVEY = 4;
const MANUAL_RACE_MS = 2400;

function usePrefersReducedMotion() {
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

/** Runs 0 → 1 whenever `key` changes. Reduced motion jumps straight to 1. */
function useRace(key: string, reduced: boolean) {
  const [progress, setProgress] = useState(1);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const value = Math.min(1, (now - start) / MANUAL_RACE_MS);
      setProgress(value);
      if (value < 1) frame.current = requestAnimationFrame(step);
    };
    setProgress(0);
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [key, reduced]);

  return progress;
}

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function RoiRace() {
  const reduced = usePrefersReducedMotion();
  const [photos, setPhotos] = useState(150);
  const [surveys, setSurveys] = useState(2);
  const [dayRateInput, setDayRateInput] = useState("300");

  const dayRate = Math.max(0, Number(dayRateInput.replace(/[^0-9.]/g, "")) || 0);

  const manualHoursPerSurvey = photos / PHOTOS_PER_MANUAL_HOUR;
  const appHoursPerSurvey = APP_MINUTES_PER_SURVEY / 60;
  const manualHoursPerMonth = manualHoursPerSurvey * surveys;
  const appHoursPerMonth = appHoursPerSurvey * surveys;
  const savedPerMonth = Math.max(0, manualHoursPerMonth - appHoursPerMonth);
  const daysPerYear = (savedPerMonth * 12) / 8;
  const moneyPerYear = daysPerYear * dayRate;

  const progress = useRace(`${photos}-${surveys}`, reduced);
  // The app bar finishes almost immediately; the gap is the whole point.
  const appShare = Math.max(0.02, appHoursPerSurvey / Math.max(manualHoursPerSurvey, 0.001));
  const appProgress = Math.min(1, progress / appShare);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
      <div className="space-y-8">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label htmlFor="roi-photos" className="text-sm font-semibold">
              Photos per survey
            </Label>
            <output
              htmlFor="roi-photos"
              className="text-lg font-bold tabular-nums text-brand-accent-ink"
            >
              {photos}
            </output>
          </div>
          <Slider
            id="roi-photos"
            className="mt-4 py-3 [&_[role=slider]]:size-7 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary"
            min={10}
            max={300}
            step={5}
            value={[photos]}
            onValueChange={([value]) => setPhotos(value ?? 150)}
            aria-label="Photos per survey"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label htmlFor="roi-surveys" className="text-sm font-semibold">
              Surveys per month
            </Label>
            <output
              htmlFor="roi-surveys"
              className="text-lg font-bold tabular-nums text-brand-accent-ink"
            >
              {surveys}
            </output>
          </div>
          <Slider
            id="roi-surveys"
            className="mt-4 py-3 [&_[role=slider]]:size-7 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary"
            min={1}
            max={20}
            step={1}
            value={[surveys]}
            onValueChange={([value]) => setSurveys(value ?? 2)}
            aria-label="Surveys per month"
          />
        </div>

        <div>
          <Label htmlFor="roi-rate" className="text-sm font-semibold">
            Day rate
          </Label>
          <div className="mt-3 flex items-center gap-2">
            <span aria-hidden="true" className="text-lg font-semibold">
              £
            </span>
            <Input
              id="roi-rate"
              inputMode="numeric"
              value={dayRateInput}
              onChange={(event) => setDayRateInput(event.target.value)}
              className="max-w-40 text-lg font-semibold tabular-nums"
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Assumes roughly one hour of write-up per {PHOTOS_PER_MANUAL_HOUR} photographs by hand, and{" "}
          {APP_MINUTES_PER_SURVEY} minutes per survey with Report Ready. Change the numbers to your
          own.
        </p>
      </div>

      <div className="space-y-10">
        <div className="space-y-6" aria-live="polite">
          <RaceBar
            label="Doing it yourself"
            tone="slow"
            progress={progress}
            value={`${(manualHoursPerSurvey * progress).toFixed(1)} hours`}
            caption="per survey, writing up at a desk"
          />
          <RaceBar
            label="With Report Ready"
            tone="fast"
            progress={appProgress}
            value={`${Math.round(APP_MINUTES_PER_SURVEY * appProgress)} minutes`}
            caption="per survey, photos in to issued report"
          />
        </div>

        <dl className="grid gap-5 sm:grid-cols-3">
          <BigNumber
            label="Hours saved per month"
            value={Math.round(savedPerMonth * progress).toLocaleString("en-GB")}
          />
          <BigNumber
            label="Days handed back per year"
            value={Math.round(daysPerYear * progress).toLocaleString("en-GB")}
          />
          <BigNumber label="Saved per year" value={money.format(moneyPerYear * progress)} />
        </dl>
      </div>
    </div>
  );
}

function RaceBar({
  label,
  tone,
  progress,
  value,
  caption,
}: {
  label: string;
  tone: "slow" | "fast";
  progress: number;
  value: string;
  caption: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={
            tone === "fast"
              ? "h-full rounded-full bg-brand-accent"
              : "h-full rounded-full bg-brand-blue-ink/50"
          }
          style={{ width: `${Math.max(2, progress * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function BigNumber({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-raised">
      <dt className="eyebrow">{label}</dt>
      <dd className="editorial-title mt-2 text-3xl font-bold tabular-nums sm:text-4xl">{value}</dd>
    </div>
  );
}
