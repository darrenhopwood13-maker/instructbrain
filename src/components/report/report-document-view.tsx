import { Fragment } from "react";
import { StatusPill } from "@/components/status-pill";
import { PhotoFigure } from "@/components/report/photo-figure";
import { InlineField } from "@/components/report/inline-field";
import {
  documentSections,
  documentStatistics,
  formatDocumentDate,
  groupFindings,
  groupingForSection,
  sectionLabel,
  type DocFinding,
  type ReportDocument,
} from "@/lib/report/document";
import type { FindingPatch, ReportPatch } from "@/lib/report/report-data";
import {
  NOT_ASSESSED_ID,
  definesField,
  definitionLabel,
  regulatoryReferencesOf,
  requiresLifecycle,
  requiresTradeAssignment,
  resolveCategory,
  resolveSeverity,
  resolveStatus,
  severitiesOf,
  statusesOf,
  tradesOf,
} from "@/lib/survey-types";
import { AlertTriangle, Lock } from "lucide-react";

/**
 * The assembled document, on screen and in print. Section order comes from the
 * snapshot's outputSections — never from a list in this file.
 */

type Handlers = {
  onReportPatch?: (patch: ReportPatch, before: Record<string, unknown>) => Promise<void>;
  onFindingPatch?: (
    finding: DocFinding,
    patch: FindingPatch,
    before: Record<string, unknown>,
  ) => Promise<void>;
};

export function ReportDocumentView({
  document,
  editable = false,
  print = false,
  onReportPatch,
  onFindingPatch,
}: { document: ReportDocument; editable?: boolean; print?: boolean } & Handlers) {
  const sections = documentSections(document.snapshot);
  const readOnly = !editable || !onReportPatch;

  return (
    <article
      className="report-document space-y-10"
      style={
        document.organisation?.brandColour
          ? ({ "--brand-accent": document.organisation.brandColour } as React.CSSProperties)
          : undefined
      }
    >
      {sections.map((section) => (
        <Fragment key={section}>
          <Section
            section={section}
            document={document}
            readOnly={readOnly}
            print={print}
            {...(onReportPatch ? { onReportPatch } : {})}
            {...(onFindingPatch ? { onFindingPatch } : {})}
          />
        </Fragment>
      ))}
    </article>
  );
}

function Section({
  section,
  document,
  readOnly,
  print,
  onReportPatch,
  onFindingPatch,
}: { section: string; document: ReportDocument; readOnly: boolean; print: boolean } & Handlers) {
  if (section === "cover") return <Cover document={document} />;

  if (section === "scope" || section === "methodology" || section === "summary") {
    const map = {
      scope: {
        value: document.report.scopeText ?? "",
        column: "scope_text" as const,
        placeholder:
          "What this survey covered, what it did not, and any limitation on access, weather or visibility.",
      },
      methodology: {
        value: document.report.methodologyText ?? "",
        column: "methodology_text" as const,
        placeholder: "How the survey was carried out, and with what equipment.",
      },
      summary: {
        value: document.report.executiveSummary ?? "",
        column: "executive_summary" as const,
        placeholder: "A short professional summary of the outcome of this survey.",
      },
    }[section];

    return (
      <section aria-labelledby={`section-${section}`} className="break-inside-avoid">
        <h2 id={`section-${section}`} className="editorial-title text-xl font-semibold">
          {sectionLabel(section)}
        </h2>
        <div className="mt-3">
          <InlineField
            label={sectionLabel(section)}
            value={map.value}
            readOnly={readOnly}
            multiline
            rows={section === "summary" ? 8 : 5}
            placeholder={map.placeholder}
            onSave={async (next) =>
              onReportPatch?.({ [map.column]: next || null } as ReportPatch, {
                [map.column]: map.value,
              })
            }
          />
        </div>
        {section === "summary" ? <SummaryExtras document={document} /> : null}
      </section>
    );
  }

  if (section.startsWith("schedule")) {
    return (
      <Schedule
        section={section}
        document={document}
        readOnly={readOnly}
        {...(onFindingPatch ? { onFindingPatch } : {})}
      />
    );
  }

  if (section === "appendix") return <Appendix document={document} print={print} />;

  return null;
}

/* ------------------------------------------------------------------ */

function Cover({ document }: { document: ReportDocument }) {
  const cover =
    document.photos.find((photo) => photo.id === document.report.coverPhotoId) ??
    document.photos[0] ??
    null;

  return (
    <section aria-label="Cover" className="break-after-page">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand-blue pb-5">
        <div className="flex items-center gap-3">
          {document.organisation?.logoUrl ? (
            <img
              src={document.organisation.logoUrl}
              alt={`${document.organisation.name} logo`}
              className="h-12 w-auto object-contain"
            />
          ) : null}
          <p className="editorial-title text-lg font-semibold">
            {document.organisation?.name ?? "Organisation not recorded"}
          </p>
        </div>
        <p className="eyebrow">{definitionLabel(document.snapshot)}</p>
      </div>

      <h1 className="editorial-title mt-8 text-3xl font-semibold leading-tight sm:text-4xl">
        {document.report.title}
      </h1>
      {document.report.subtitle ? (
        <p className="mt-2 text-lg text-muted-foreground">{document.report.subtitle}</p>
      ) : null}

      <dl className="mt-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Pair label="Project" value={document.project?.name ?? "Not recorded"} />
        <Pair label="Client" value={document.project?.clientName ?? "Not recorded"} />
        <Pair label="Address" value={document.project?.address ?? "Not recorded"} />
        <Pair
          label="Principal contractor"
          value={document.project?.principalContractor ?? "Not recorded"}
        />
        <Pair label="Report reference" value={document.report.reference ?? "Not recorded"} />
        <Pair label="Report date" value={formatDocumentDate(document.report.reportDate)} />
        <Pair label="Author" value={document.author ?? "Not recorded"} />
        <Pair
          label="Status"
          value={
            document.report.status === "issued"
              ? `Issued ${formatDocumentDate(document.report.issuedAt)} · version ${document.report.currentVersion}`
              : "Draft — not yet issued"
          }
        />
      </dl>

      {cover ? (
        <img
          src={cover.url ?? cover.thumbUrl ?? ""}
          alt={`Cover photograph — ${document.project?.name ?? document.report.title}`}
          className="mt-8 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      ) : null}
    </section>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SummaryExtras({ document }: { document: ReportDocument }) {
  const stats = documentStatistics(document);
  const synthesis = document.synthesis;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <h3 className="eyebrow">Statistics</h3>
        <p className="mt-2 text-sm">
          {stats.total} finding{stats.total === 1 ? "" : "s"} · {stats.percentAssessed}% assessed
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.byStatus.map((entry) => (
            <span key={entry.id} className="text-xs">
              <StatusPill status={resolveStatus(document.snapshot, entry.id)} /> ×{entry.count}
            </span>
          ))}
        </div>
        {stats.bySeverity.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Severity:{" "}
            {stats.bySeverity.map((entry) => `${entry.label} ${entry.count}`).join(" · ")}
          </p>
        ) : null}
        {stats.byTrade.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            By trade: {stats.byTrade.map((entry) => `${entry.trade} ${entry.count}`).join(" · ")}
          </p>
        ) : null}
      </div>

      {synthesis && (synthesis.actions.length > 0 || synthesis.patterns.length > 0) ? (
        <div
          className={
            document.report.synthesisConfirmed
              ? "rounded-xl border border-border bg-surface-raised p-4"
              : "rounded-xl border border-brand-purple/40 bg-brand-purple-soft/40 p-4"
          }
        >
          {!document.report.synthesisConfirmed ? (
            <p className="eyebrow text-brand-purple-ink">
              AI-generated — not yet confirmed by a person
            </p>
          ) : null}
          {synthesis.actions.length > 0 ? (
            <>
              <h3 className="editorial-title mt-2 text-base font-semibold">Prioritised actions</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                {synthesis.actions.map((action, index) => (
                  <li key={`${action.ref ?? "action"}-${index}`}>
                    {action.ref ? <strong>{action.ref} — </strong> : null}
                    {action.action}
                    {action.priority ? (
                      <span className="text-muted-foreground"> ({action.priority})</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {synthesis.patterns.length > 0 ? (
            <>
              <h3 className="editorial-title mt-4 text-base font-semibold">Patterns identified</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {synthesis.patterns.map((pattern, index) => (
                  <li key={`${pattern.title}-${index}`}>
                    <strong>{pattern.title}</strong>
                    <span className="block text-muted-foreground">{pattern.detail}</span>
                    {pattern.refs.length > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        Refs: {pattern.refs.join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Schedule({
  section,
  document,
  readOnly,
  onFindingPatch,
}: { section: string; document: ReportDocument; readOnly: boolean } & Handlers) {
  const groups = groupFindings(document.findings, groupingForSection(section));

  return (
    <section aria-labelledby={`section-${section}`}>
      <h2 id={`section-${section}`} className="editorial-title text-xl font-semibold">
        {sectionLabel(section)}
      </h2>
      {document.findings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No findings have been recorded on this report yet.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="mt-5">
            {groups.length > 1 || group.key !== "all" ? (
              <h3 className="eyebrow border-b border-border pb-1.5">{group.label}</h3>
            ) : null}
            <ul className="mt-3 space-y-4">
              {group.findings.map((finding) => (
                <li key={finding.id}>
                  <FindingRow
                    document={document}
                    finding={finding}
                    readOnly={readOnly}
                    {...(onFindingPatch ? { onFindingPatch } : {})}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function FindingRow({
  document,
  finding,
  readOnly,
  onFindingPatch,
}: { document: ReportDocument; finding: DocFinding; readOnly: boolean } & Handlers) {
  const snapshot = document.snapshot;
  const status = resolveStatus(snapshot, finding.statusId);
  const severity = finding.severityId ? resolveSeverity(snapshot, finding.severityId) : null;
  const category = finding.categoryId ? resolveCategory(snapshot, finding.categoryId) : null;
  const notAssessed = status.id === NOT_ASSESSED_ID;
  const primary = finding.photos[0];
  const references = regulatoryReferencesOf(snapshot);

  const patch = async (values: FindingPatch, before: Record<string, unknown>) =>
    onFindingPatch?.(finding, values, before);

  return (
    <div
      className={
        "break-inside-avoid rounded-xl border bg-surface-raised p-4 shadow-raised " +
        (notAssessed ? "border-flag/50" : "border-border")
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {finding.photos.length > 0 ? (
            finding.photos.map((attachment) => (
              <PhotoFigure
                key={`${attachment.photo.id}-${attachment.role}`}
                attachment={attachment}
                caption={`Photograph ${attachment.photo.sequence}`}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              No photograph attached to this finding.
            </p>
          )}
          {primary?.photo.capturedAt ? (
            <p className="text-xs text-muted-foreground">
              Taken {formatDocumentDate(primary.photo.capturedAt)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-xs font-semibold">
              {finding.ref}
            </span>
            <StatusPill status={status} />
            {severity ? (
              <span className="text-xs font-medium text-muted-foreground">
                Severity: {severity.label}
              </span>
            ) : null}
            {category ? (
              <span className="text-xs text-muted-foreground">{category.label}</span>
            ) : null}
            {finding.isConfidential ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-flag/40 bg-flag-soft px-2 py-0.5 text-xs font-semibold text-flag">
                <Lock aria-hidden="true" className="size-3" />
                Confidential — excluded from trade extracts
              </span>
            ) : null}
          </div>

          {notAssessed ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-flag-soft px-2.5 py-2 text-xs text-flag">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Not assessed — a person must resolve this before the report can be issued.
              {finding.abstainReason ? ` Reason given: ${finding.abstainReason}` : ""}
            </p>
          ) : null}

          {Object.keys(finding.captureFields).length > 0 ? (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(finding.captureFields).map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <dt className="font-medium capitalize">{key.replace(/_/g, " ")}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-3 space-y-3">
            <InlineField
              label="Finding"
              value={finding.findingText}
              readOnly={readOnly}
              multiline
              rows={3}
              onSave={async (next) =>
                patch({ finding_text: next }, { finding_text: finding.findingText })
              }
            />
            <InlineField
              label="Remedial action"
              value={finding.remedialText}
              readOnly={readOnly}
              multiline
              rows={3}
              onSave={async (next) =>
                patch({ remedial_text: next }, { remedial_text: finding.remedialText })
              }
            />

            {definesField(snapshot, "likely_cause") ? (
              <InlineField
                label="Most likely cause (assessment, not a finding of fact)"
                value={finding.likelyCause ?? ""}
                readOnly={readOnly}
                multiline
                rows={2}
                onSave={async (next) =>
                  patch({ likely_cause: next || null }, { likely_cause: finding.likelyCause })
                }
              />
            ) : null}

            {definesField(snapshot, "regulatory_reference") && finding.regulatoryReference ? (
              <p className="text-xs text-muted-foreground">
                Reference:{" "}
                {references.find((item) => item.id === finding.regulatoryReference)?.label ??
                  finding.regulatoryReference}
              </p>
            ) : null}
          </div>

          {readOnly ? (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {requiresTradeAssignment(snapshot) ? (
                <span>Trade: {finding.assignedTrade ?? "Not confirmed"}</span>
              ) : null}
              {requiresLifecycle(snapshot) ? (
                <span>Target date: {formatDocumentDate(finding.dueDate)}</span>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="eyebrow block">
                Status
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
                  value={status.id}
                  onChange={(event) =>
                    void patch({ status: event.target.value }, { status: finding.statusId })
                  }
                >
                  {statusesOf(snapshot).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {severitiesOf(snapshot).length > 0 ? (
                <label className="eyebrow block">
                  Severity
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
                    value={finding.severityId ?? ""}
                    onChange={(event) =>
                      void patch(
                        { severity: event.target.value || null },
                        { severity: finding.severityId },
                      )
                    }
                  >
                    <option value="">Not set</option>
                    {severitiesOf(snapshot).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {requiresTradeAssignment(snapshot) ? (
                <label className="eyebrow block">
                  Responsible trade (your decision)
                  <input
                    list={`trades-${finding.id}`}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
                    defaultValue={finding.assignedTrade ?? ""}
                    onBlur={(event) =>
                      void patch(
                        { assigned_trade: event.target.value.trim() || null },
                        { assigned_trade: finding.assignedTrade },
                      )
                    }
                  />
                  <datalist id={`trades-${finding.id}`}>
                    {tradesOf(snapshot).map((trade) => (
                      <option key={trade} value={trade} />
                    ))}
                  </datalist>
                  {finding.suggestedTrade ? (
                    <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted-foreground">
                      AI suggested {finding.suggestedTrade}
                      {typeof finding.tradeConfidence === "number"
                        ? ` (confidence ${Math.round(finding.tradeConfidence * 100)}%)`
                        : ""}
                      {finding.tradeReasoning ? ` — ${finding.tradeReasoning}` : ""}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {requiresLifecycle(snapshot) ? (
                <InlineField
                  label="Target date"
                  type="date"
                  value={finding.dueDate ?? ""}
                  onSave={async (next) =>
                    patch({ due_date: next || null }, { due_date: finding.dueDate })
                  }
                />
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={notAssessed || !!finding.confirmedAt}
                  onClick={() =>
                    void patch(
                      { confirmed_at: new Date().toISOString() },
                      { confirmed_at: finding.confirmedAt },
                    )
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {finding.confirmedAt
                    ? "Confirmed"
                    : notAssessed
                      ? "Resolve the status before confirming"
                      : "Confirm this finding"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Appendix({ document, print }: { document: ReportDocument; print: boolean }) {
  return (
    <section aria-labelledby="section-appendix" className="break-before-page">
      <h2 id="section-appendix" className="editorial-title text-xl font-semibold">
        {sectionLabel("appendix")}
      </h2>
      {document.photos.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No photographs on this report.</p>
      ) : (
        <ul className="mt-4 grid gap-5 sm:grid-cols-2">
          {document.photos.map((photo) => {
            const refs = document.findings
              .filter((finding) => finding.photos.some((item) => item.photo.id === photo.id))
              .map((finding) => finding.ref);
            return (
              <li key={photo.id} className="break-inside-avoid">
                <PhotoFigure
                  attachment={{ photo, role: "primary", region: null }}
                  useFullResolution={print}
                  caption={`Photograph ${photo.sequence} · ${formatDocumentDate(photo.capturedAt)}${
                    refs.length > 0 ? ` · ${refs.join(", ")}` : " · not linked to a finding"
                  }`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
