import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FolderOpen, HardHat, Users, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession, signOut } from "@/lib/auth";
import { organisationQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { useI18n } from "@/i18n/i18n-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsWideViewport } from "@/hooks/use-mobile";
import { useIsPlatformAdmin } from "@/lib/platform-admin";
import { HelpSheet, OPEN_HELP_EVENT } from "@/components/help-sheet";
import { toast } from "sonner";
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
        className="console-control inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium text-foreground transition-colors"
      >
        {t("action.signIn")}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account — ${user.email ?? "signed in"}`}
        className="console-control inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-2 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70 sm:px-3"
      >
        <UserCog aria-hidden="true" className="size-4 shrink-0" />
        {/* The word only appears once the row can afford it: between 640 and
            1023 the primary nav is in the same row. */}
        <span className="hidden lg:inline">{t("nav.account")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/account">{t("nav.account")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.dispatchEvent(new Event(OPEN_HELP_EVENT));
          }}
        >
          {t("nav.help")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/organisation">{t("nav.organisation")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const url = "https://instructbrain.com/promo";
            try {
              if (navigator.share) {
                await navigator.share({ title: "instructBrain", url });
                return;
              }
            } catch {
              return; // share sheet cancelled — send nothing, show nothing
            }
            try {
              await navigator.clipboard.writeText(url);
              toast.success(t("nav.sharePromoCopied"), { description: url });
            } catch {
              window.open(url, "_blank", "noopener");
            }
          }}
        >
          {t("nav.sharePromo")}
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

/**
 * Four evenly sized destinations. Organisation settings is a twice-a-year
 * screen, so it lives in the Account menu and its slot goes to the field
 * cockpit — one tap to capture when someone arrives on site.
 */
const baseNav = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/projects", key: "nav.projects", icon: FolderOpen, exact: false },
  { to: "/field", key: "nav.field", icon: HardHat, exact: false },
  { to: "/settings/directory", key: "nav.directory", icon: Users, exact: false },
] as const;

export function AppShell({
  children,
  surface = "console",
  chrome = "full",
}: {
  children: ReactNode;
  /**
   * "light" puts the whole screen on the working-surface scope: white sheet,
   * dark text, no blueprint grid or console chrome. Used on the screens people
   * work from outdoors — capture, photos, review, compliance register.
   */
  surface?: "console" | "light";
  /**
   * "field" is the on-site cockpit: on a phone, or installed to the home
   * screen, the menus and bottom navigation are removed. Desktop is unchanged.
   */
  chrome?: "full" | "field";
}) {
  const { t } = useI18n();
  const { organisationId } = useOrganisations();
  const organisation = useQuery(organisationQuery(organisationId));
  // One set of destinations, rendered once. Header links from `sm` upwards,
  // the fixed bar below it — never both, so the nav is not in the document twice.
  const wide = useIsWideViewport();
  // The trade layer is optional: with it switched off the recipient directory has
  // nothing to do, so it leaves the navigation rather than sitting there empty.
  const tradeAllocationEnabled = organisation.data?.trade_allocation_enabled !== false;
  const nav = baseNav.filter(
    (item) => item.key !== "nav.directory" || tradeAllocationEnabled,
  );

  return (
    <div
      className={`flex min-h-dvh flex-col ${surface === "light" ? "work-surface" : "console-surface"}${chrome === "field" ? " field-chrome" : ""}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-brand-accent focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        Skip to main content
      </a>

      <header className="app-shell-header sticky top-0 z-30 border-b border-border bg-surface-raised/95 backdrop-blur">
        {/* Tighter gaps below md: at 320px the row is only just wide enough for
            the wordmark plus two 44px-tall controls, and at 640px the primary
            nav joins the row and 16px gaps push the wordmark into an ellipsis. */}
        <div className="shell-container flex items-center gap-2 py-5 md:gap-4">
          <Link to="/dashboard" className="mr-auto flex min-w-0 items-center gap-2.5 rounded-md">
            <span className="min-w-0">
              {/* 16px on a phone, not 18px: the wordmark is the flexible element,
                  and at 320px Audiowide needs 143px where the row can give 135.
                  It stays 16px until md because between 640 and 1023 the primary
                  nav shares the row with it and 20px does not fit. */}
              <span className="wordmark block truncate text-base leading-tight md:text-xl">
                <span className="wordmark-instruct text-foreground">instruct</span>
                <span className={surface === "light" ? "work-wordmark-brain" : "text-brand-accent"}>
                  Brain
                </span>
              </span>
            </span>
          </Link>

          {wide ? (
            <nav aria-label="Primary" className="app-shell-primary-nav ml-auto hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className="rounded-md border border-transparent px-2 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-brand-accent/55 hover:bg-surface-sunken hover:text-foreground data-[status=active]:border-brand-accent data-[status=active]:bg-brand-accent/10 data-[status=active]:text-foreground lg:px-3"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          ) : null}
          <LanguageToggle compact />
          <AccountMenu />
        </div>
      </header>

      <main
        id="main"
        className={`shell-container flex-1 ${chrome === "field" ? "pb-40 pt-4 sm:pb-20 sm:pt-10" : "pb-28 pt-10 sm:pb-20"} lg:pt-12`}
      >
        {children}
      </main>

      {!wide && chrome !== "field" ? (
      <nav
        aria-label="Primary mobile"
        className="app-shell-mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] sm:hidden"
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
                className="flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[0.6875rem] font-medium text-muted-foreground data-[status=active]:border-brand-accent data-[status=active]:text-foreground"
              >
                <item.icon aria-hidden="true" className="size-5" />
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      ) : null}

      <HelpSheet />
    </div>
  );
}
