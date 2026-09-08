import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FolderOpen, Building2, Users, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useSession, signOut } from "@/lib/auth";
import { useI18n } from "@/i18n/i18n-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsPlatformAdmin } from "@/lib/platform-admin";
import { HelpSheet } from "@/components/help-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Reflects the live session: signed-out users get a sign-in link, signed-in
 * users get one Account menu holding settings, admin (founder only) and sign
 * out — so the top bar stays to two controls on a phone.
 */
function AccountMenu() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { t } = useI18n();
  const { isPlatformAdmin } = useIsPlatformAdmin();

  if (loading) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (!user) {
    return (
      <Link
        to="/auth/sign-in"
        className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
      >
        {t("action.signIn")}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account — ${user.email ?? "signed in"}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70"
      >
        <UserCog aria-hidden="true" className="size-4 shrink-0" />
        <span className="hidden sm:inline">{t("nav.account")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/account">{t("nav.account")}</Link>
        </DropdownMenuItem>
        {isPlatformAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">{t("nav.admin")}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate({ to: "/auth/sign-in", replace: true });
          }}
        >
          {t("action.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Four evenly sized destinations — Account and Admin live in the top bar menu. */
const baseNav = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/projects", key: "nav.projects", icon: FolderOpen, exact: false },
  { to: "/settings/organisation", key: "nav.organisation", icon: Building2, exact: false },
  { to: "/settings/directory", key: "nav.directory", icon: Users, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const nav = [...baseNav];


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
          <Link to="/dashboard" className="mr-auto flex min-w-0 items-center gap-2.5 rounded-md">
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
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
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

      <HelpSheet />
    </div>
  );
}
