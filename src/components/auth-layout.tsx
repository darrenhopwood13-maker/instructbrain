import type { ReactNode } from "react";

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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5">
          <span>
            <span className="wordmark block text-base leading-tight">
              <span className="text-brand-accent">instruct</span>
              <span className="text-foreground">Brain</span>
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
