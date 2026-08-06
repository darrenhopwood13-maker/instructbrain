import { Link, useNavigate } from "@tanstack/react-router";
import { FolderOpen, Building2, Users, FileText, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useSession, signOut } from "@/lib/auth";

/** Reflects the live session: signed-out users get a sign-in link, signed-in users get sign-out. */
function AccountAffordance() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  if (loading) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (!user) {
    return (
      <Link
        to="/auth/sign-in"
        className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:block">
        {user.email}
      </span>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          navigate({ to: "/auth/sign-in", replace: true });
        }}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
      >
        Sign out
      </button>
    </div>
  );
}


const nav = [
  { to: "/", label: "Projects", icon: FolderOpen, exact: true },
  { to: "/settings/organisation", label: "Organisation", icon: Building2, exact: false },
  { to: "/settings/directory", label: "Directory", icon: Users, exact: false },
  { to: "/settings/account", label: "Account", icon: UserCog, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 backdrop-blur">
        <div className="shell-container flex items-center gap-4 py-5">
          <Link to="/" className="mr-auto flex min-w-0 items-center gap-2.5 rounded-md">
            <span
              aria-hidden="true"
              className="gloss grid size-8 shrink-0 place-items-center rounded-md"
            >
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="wordmark block truncate text-base leading-tight">
                <span className="text-brand-accent-light">Report</span>{" "}
                <span className="text-foreground">Ready</span>
              </span>
            </span>

          </Link>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 sm:flex">
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
          <AccountAffordance />

        </div>
      </header>

      <main id="main" className="shell-container flex-1 pb-28 pt-10 sm:pb-20 lg:pt-12">
        {children}
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid grid-cols-4">
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
