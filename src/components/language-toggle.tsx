import { Globe } from "lucide-react";
import { LANGUAGES } from "@/i18n/languages";
import { useI18n } from "@/i18n/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Language is always reversible: English is the record copy and one press
 * returns to it, from where any other language can be chosen.
 *
 * `compact` is the top-bar form — a small accent-coloured control showing the
 * current language code, with the full list behind it.
 */
export function LanguageToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { language, setLanguage, translated, loading } = useI18n();
  const current = LANGUAGES.find((item) => item.code === language);

  if (compact) {
    return (
      <div className={className}>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Language — currently ${current?.native ?? "English"}`}
            className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-md border border-brand-accent/40 bg-brand-accent/10 px-2.5 text-xs font-bold uppercase tracking-wide text-brand-accent-ink transition-colors hover:bg-brand-accent/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70"
          >
            <Globe aria-hidden="true" className="size-4 shrink-0" />
            {current?.label ?? "EN"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            {translated ? (
              <>
                <DropdownMenuItem onSelect={() => setLanguage("en")}>
                  Revert to English
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {LANGUAGES.map((item) => (
              <DropdownMenuItem key={item.code} onSelect={() => setLanguage(item.code)}>
                <span className="flex-1">{item.native}</span>
                {item.code === language ? (
                  <span className="text-xs text-muted-foreground">Current</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span aria-live="polite" className="sr-only">
          {loading
            ? "Loading translation"
            : `Language set to ${language === "en" ? "English" : language}`}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <Globe aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger
            aria-label="Language"
            className="h-11 w-[7.5rem] border-border bg-transparent text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {LANGUAGES.map((item) => (
              <SelectItem key={item.code} value={item.code}>
                {item.native}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {translated ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setLanguage("en")}
            className="h-11"
          >
            Revert to English
          </Button>
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {loading ? "Loading translation" : `Language set to ${language === "en" ? "English" : language}`}
      </span>
    </div>
  );
}
