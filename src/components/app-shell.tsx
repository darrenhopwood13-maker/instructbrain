import { Link, useNavigate } from "@tanstack/react-router";
import { FolderOpen, Building2, Users, UserCog, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useSession, signOut } from "@/lib/auth";
import { useI18n } from "@/i18n/i18n-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsPlatformAdmin } from "@/lib/platform-admin";

/** Reflects the live session: signed-out users get a sign-in link, signed-in users get sign-out. */
function AccountAffordance() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { t } = useI18n();

  if (loading) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (!user) {
    return (
      <Link
        to="/auth/sign-in"
        className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
      >
        {t("action.signIn")}
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
        {t("action.signOut")}
      </button>
    </div>
  );
}

const baseNav = [
  { to: "/projects", key: "nav.projects", icon: FolderOpen, exact: true },
  { to: "/settings/organisation", key: "nav.organisation", icon: Building2, exact: false },
  { to: "/settings/directory", key: "nav.directory", icon: Users, exact: false },
  { to: "/settings/account", key: "nav.account", icon: UserCog, exact: false },
] as const;

const adminNav = {
  to: "/admin",
  key: "nav.admin",
  icon: ShieldCheck,
  exact: false,
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const nav = isPlatformAdmin ? [...baseNav, adminNav] : [...baseNav];

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
          <Link to="/projects" className="mr-auto flex min-w-0 items-center gap-2.5 rounded-md">
            <span className="min-w-0">
              <span className="wordmark block truncate text-base leading-tight">
                <span className="text-brand-accent">instruct</span>
                <span className="text-foreground">Brain</span>
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
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <LanguageToggle className="hidden md:block" />
          <AccountAffordance />
        </div>
      </header>

      <main id="main" className="shell-container flex-1 pb-28 pt-10 sm:pb-20 lg:pt-12">
        <LanguageToggle className="mb-6 md:hidden" />
        {children}
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className={nav.length === 5 ? "grid grid-cols-5" : "grid grid-cols-4"}>
          {nav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground data-[status=active]:text-brand-blue-ink"
              >
                <item.icon aria-hidden="true" className="size-5" />
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
