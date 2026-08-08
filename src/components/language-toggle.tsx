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
import { Button } from "@/components/ui/button";

/**
 * Language is always reversible: English is the record copy and one press
 * returns to it, from where any other language can be chosen.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, translated, loading } = useI18n();

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
