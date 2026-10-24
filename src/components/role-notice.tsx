import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

/**
 * Shown where a screen exists but is not this person's job.
 *
 * Deliberately not a 404: a surveyor who lands on the estate map has not mistyped a URL,
 * they have followed a link someone sent them, and "this is for the people who review the
 * estate" is a sentence they can act on.
 */
export function RoleNotice({
  title,
  body,
  backTo = "/reports",
  backLabel = "Go to reports",
}: {
  title: string;
  body: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-2xl border border-border bg-surface-raised p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-sunken">
        <Lock aria-hidden="true" className="size-5 text-muted-foreground" />
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-base text-muted-foreground">{body}</p>
      <Link
        to={backTo}
        className="mt-1 inline-flex min-h-11 items-center rounded-full bg-brand-accent-ink px-4 text-sm font-semibold text-white"
      >
        {backLabel}
      </Link>
    </div>
  );
}
