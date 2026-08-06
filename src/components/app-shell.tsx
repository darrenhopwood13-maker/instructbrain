import { Link } from "@tanstack/react-router";
import { FolderOpen, Building2, Users, FileText } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Projects", icon: FolderOpen, exact: true },
  { to: "/settings/organisation", label: "Organisation", icon: Building2, exact: false },
  { to: "/settings/directory", label: "Directory", icon: Users, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-purple focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-md">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-blue text-primary-foreground"
            >
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="editorial-title block truncate text-base font-semibold leading-tight">
                Report Ready
              </span>
              <span className="hidden text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:block">
                Instruct Suite
              </span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground data-[status=active]:bg-brand-blue-soft data-[status=active]:text-brand-blue-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/auth/sign-in"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken sm:hidden"
          >
            Account
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-16">
        {children}
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid grid-cols-3">
          {nav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground data-[status=active]:text-brand-blue-ink"
              >
                <item.icon aria-hidden="true" className="size-5" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
