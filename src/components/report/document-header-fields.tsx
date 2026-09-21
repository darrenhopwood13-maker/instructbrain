import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The document header a report writes for itself: main title, subtitle and
 * date, with the author shown read-only.
 *
 * Shown only where the report template asks for it
 * (`asksForDocumentHeader`) — no route decides this by naming a discipline.
 * Left blank, the automatic title stands.
 */
export function DocumentHeaderFields(props: {
  title: string;
  subtitle: string;
  reportDate: string;
  authorLabel: string;
  titlePlaceholder?: string;
  onTitle: (value: string) => void;
  onSubtitle: (value: string) => void;
  onReportDate: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-raised p-4">
      <p className="eyebrow">Document header</p>

      <div className="space-y-2">
        <Label htmlFor="report-title">Main title</Label>
        <Input
          id="report-title"
          autoComplete="off"
          value={props.title}
          onChange={(event) => props.onTitle(event.target.value)}
          placeholder={props.titlePlaceholder ?? "Report title"}
          disabled={props.disabled ?? false}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-subtitle">Subtitle</Label>
        <Input
          id="report-subtitle"
          autoComplete="off"
          value={props.subtitle}
          onChange={(event) => props.onSubtitle(event.target.value)}
          placeholder="Address or occupancy detail"
          disabled={props.disabled ?? false}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-date">Report date</Label>
        <Input
          id="report-date"
          type="date"
          value={props.reportDate}
          onChange={(event) => props.onReportDate(event.target.value)}
          disabled={props.disabled ?? false}
          className="h-11"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Author</p>
        <p className="text-sm text-muted-foreground">
          {props.authorLabel} — recorded automatically on the report.
        </p>
      </div>
    </div>
  );
}
