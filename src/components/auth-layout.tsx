import type { ReactNode } from "react";
import { FileText } from "lucide-react";

export function AuthLayout({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-md bg-brand-blue text-primary-foreground"
          >
            <FileText className="size-4" />
          </span>
          <span>
            <span className="editorial-title block text-base font-semibold leading-tight">
              Report Ready
            </span>
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface-raised p-6 shadow-raised sm:p-8">
          <h1 className="editorial-title text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-4 text-center text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}
