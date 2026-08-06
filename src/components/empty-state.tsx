import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface-raised px-6 py-12 text-center sm:py-16">
      <span className="grid size-11 place-items-center rounded-lg border border-border bg-surface-sunken text-brand-blue">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      {eyebrow ? <p className="eyebrow mt-5">{eyebrow}</p> : null}
      <h3 className="editorial-title mt-2 max-w-sm text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
