import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline, autosaved field. Saves on blur and after a pause, never on every
 * keystroke, and states what it has done rather than saving silently.
 */
export function InlineField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  readOnly = false,
  className,
  rows = 4,
  type = "text",
}: {
  label: string;
  value: string;
  onSave: (next: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  rows?: number;
  type?: "text" | "date";
}) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const committed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  const commit = async (next: string) => {
    if (next === committed.current) return;
    setState("saving");
    try {
      await onSave(next);
      committed.current = next;
      setState("saved");
      setMessage(null);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The change could not be saved.");
    }
  };

  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commit(next), 1200);
  };

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  if (readOnly) {
    return (
      <div className={className}>
        <p className="eyebrow">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {value || <span className="text-muted-foreground">Not recorded</span>}
        </p>
      </div>
    );
  }

  const shared =
    "mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm leading-relaxed focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/30";

  return (
    <div className={className}>
      <label className="eyebrow block">
        {label}
        {multiline ? (
          <textarea
            className={cn(shared, "resize-y")}
            rows={rows}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => {
              setDraft(event.target.value);
              setState("idle");
              schedule(event.target.value);
            }}
            onBlur={() => void commit(draft)}
          />
        ) : (
          <input
            type={type}
            className={shared}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => {
              setDraft(event.target.value);
              setState("idle");
              schedule(event.target.value);
            }}
            onBlur={() => void commit(draft)}
          />
        )}
      </label>
      <p
        aria-live="polite"
        className={cn(
          "mt-1 text-xs",
          state === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {state === "saving"
          ? "Saving…"
          : state === "saved"
            ? "Saved"
            : state === "error"
              ? (message ?? "Not saved")
              : ""}
      </p>
    </div>
  );
}
