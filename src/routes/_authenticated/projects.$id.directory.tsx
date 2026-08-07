import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Contact,
  Copy,
  Plus,
  Save,
  Trash2,
  Upload,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { projectQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import {
  addDirectoryContact,
  applyDirectoryTemplate,
  copyDirectoryFromProject,
  copyableProjectsQuery,
  createDirectoryEntry,
  deleteDirectoryContact,
  deleteDirectoryEntry,
  directoryTemplatesQuery,
  fallbackIsSet,
  fallbackRecipientQuery,
  importDirectoryGroups,
  projectDirectoryQuery,
  saveDirectoryAsTemplate,
  updateDirectoryContact,
  updateDirectoryEntry,
  updateFallbackRecipient,
  type DirectoryEntryFull,
} from "@/lib/directory/directory-data";
import {
  CSV_TEMPLATE,
  groupImportRows,
  parseDirectoryCsv,
  type CsvParseResult,
} from "@/lib/directory/csv-import";

/**
 * The project directory: who is on this job, and who receives anything that
 * has not been given to a trade. Distribution is blocked until the fallback
 * recipient exists, because unowned items are how things get missed.
 */
export const Route = createFileRoute("/_authenticated/projects/$id/directory")({
  head: () => {
    const title = "Project directory — instructBrain";
    const description =
      "Trades, companies and contacts for this project, plus the fallback recipient for unassigned items.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProjectDirectory,
});

function ProjectDirectory() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { organisationId, organisationIds } = useOrganisations();
  const project = useQuery(projectQuery(id));
  const directory = useQuery(projectDirectoryQuery(id));
  const fallback = useQuery(fallbackRecipientQuery(id));
  const templates = useQuery(directoryTemplatesQuery(organisationIds));
  const others = useQuery(copyableProjectsQuery(organisationIds, id));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["project-directory", id] });
    await queryClient.invalidateQueries({ queryKey: ["fallback-recipient", id] });
  };

  const guard = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (error) {
      toast.error("That change could not be saved", {
        description: error instanceof Error ? error.message : "Nothing was changed.",
      });
    }
  };

  const entries = directory.data ?? [];

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <Link
          to="/projects/$id"
          params={{ id }}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          {project.data?.reference ?? project.data?.name ?? "Project"}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">Directory</span>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">Project directory</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          {project.data?.name ?? "This project"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every trade working on this job, and the one person who receives anything nobody has
          been assigned. Extracts are addressed to the primary contact for each trade.
        </p>
      </header>

      <FallbackPanel
        key={fallback.dataUpdatedAt}
        projectId={id}
        value={fallback.data ?? { name: null, email: null }}
        onSaved={refresh}
      />

      <section className="mt-8 flex flex-wrap items-center gap-2">
        <AddEntryDialog
          onSubmit={(values) =>
            guard(
              () => createDirectoryEntry({ projectId: id, ...values }),
              `${values.trade} added to the directory`,
            )
          }
        />
        <ImportDialog
          onImport={(groups) =>
            guard(
              () => importDirectoryGroups(id, groups),
              `${groups.length} entr${groups.length === 1 ? "y" : "ies"} imported`,
            )
          }
        />
        <CopyDialog
          projects={others.data ?? []}
          onCopy={(sourceId) =>
            guard(
              () => copyDirectoryFromProject(sourceId, id),
              "Directory copied from that project",
            )
          }
        />
        <TemplateDialog
          templates={templates.data ?? []}
          canSave={entries.length > 0 && !!organisationId}
          onApply={(template) =>
            guard(() => applyDirectoryTemplate(template, id), `${template.name} applied`)
          }
          onSave={(name) =>
            guard(async () => {
              if (!organisationId) throw new Error("No organisation is selected.");
              await saveDirectoryAsTemplate({ organisationId, name, entries });
              await queryClient.invalidateQueries({ queryKey: ["directory-templates"] });
            }, `Saved as the template "${name}"`)
          }
        />
      </section>

      <section className="mt-6">
        {directory.isPending ? (
          <LoadingState label="Loading the directory…" />
        ) : directory.isError ? (
          <ErrorState
            title="The directory could not be loaded"
            error={directory.error}
            onRetry={() => void directory.refetch()}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Contact}
            eyebrow="Nothing here yet"
            title="No trades on this project"
            description="Add a trade, import a spreadsheet, or copy the directory from a previous project."
          />
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onChange={(patch, message) =>
                  guard(() => updateDirectoryEntry(entry.id, patch), message)
                }
                onDelete={() =>
                  guard(() => deleteDirectoryEntry(entry.id), `${entry.trade} removed`)
                }
                onAddContact={(values) =>
                  guard(
                    () => addDirectoryContact({ directoryId: entry.id, ...values }),
                    `${values.name || values.email} added`,
                  )
                }
                onUpdateContact={(contactId, patch, message) =>
                  guard(() => updateDirectoryContact(contactId, entry.id, patch), message)
                }
                onDeleteContact={(contactId, name) =>
                  guard(() => deleteDirectoryContact(contactId), `${name} removed`)
                }
              />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function FallbackPanel({
  projectId,
  value,
  onSaved,
}: {
  projectId: string;
  value: { name: string | null; email: string | null };
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(value.name ?? "");
  const [email, setEmail] = useState(value.email ?? "");
  const [saving, setSaving] = useState(false);
  const set = fallbackIsSet(value);

  const save = async () => {
    setSaving(true);
    try {
      await updateFallbackRecipient(projectId, { name, email });
      await onSaved();
      toast.success("Fallback recipient saved");
    } catch (error) {
      toast.error("That could not be saved", {
        description: error instanceof Error ? error.message : "Nothing was changed.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={
        "mt-8 rounded-xl border p-4 " +
        (set ? "border-border bg-surface-raised" : "border-warn/50 bg-warn-soft")
      }
    >
      <h2 className="editorial-title flex items-center gap-2 text-base font-semibold">
        <UserRoundCog aria-hidden="true" className="size-4" />
        Fallback recipient
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Usually the principal contractor&rsquo;s site manager. Anything without a trade goes to
        them. {set ? "" : "Distribution is blocked until this is set."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="fallback-name" className="eyebrow block text-muted-foreground">
            Name
          </label>
          <input
            id="fallback-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
          />
        </div>
        <div>
          <label htmlFor="fallback-email" className="eyebrow block text-muted-foreground">
            Email address
          </label>
          <input
            id="fallback-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
          />
        </div>
        <div className="flex items-end">
          <Button variant="brand" className="min-h-11 w-full" disabled={saving} onClick={() => void save()}>
            <Save aria-hidden="true" className="size-4" />
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

function EntryCard({
  entry,
  onChange,
  onDelete,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
}: {
  entry: DirectoryEntryFull;
  onChange: (
    patch: { trade?: string; company?: string; notes?: string | null; isActive?: boolean },
    message: string,
  ) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddContact: (values: {
    name: string;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }) => Promise<void>;
  onUpdateContact: (
    contactId: string,
    patch: { isPrimary?: boolean; receivesCopies?: boolean },
    message: string,
  ) => Promise<void>;
  onDeleteContact: (contactId: string, name: string) => Promise<void>;
}) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  return (
    <li
      className={
        "rounded-xl border p-4 " +
        (entry.isActive ? "border-border bg-surface-raised" : "border-border bg-surface-sunken opacity-70")
      }
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="editorial-title text-base font-semibold">{entry.trade}</h3>
            {!entry.isActive ? (
              <span className="rounded-full border border-border-strong bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold">
                Not active on this project
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">{entry.company}</p>
          {entry.notes ? <p className="mt-1 break-words text-sm">{entry.notes}</p> : null}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="quiet"
            className="min-h-11 flex-1"
            onClick={() =>
              void onChange(
                { isActive: !entry.isActive },
                entry.isActive ? `${entry.trade} deactivated` : `${entry.trade} reactivated`,
              )
            }
          >
            {entry.isActive ? "Deactivate" : "Reactivate"}
          </Button>
          <Button variant="quiet" className="min-h-11" onClick={() => void onDelete()}>
            <Trash2 aria-hidden="true" className="size-4" />
            <span className="sr-only">Remove {entry.trade}</span>
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {entry.contacts.length === 0 ? (
          <li className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm">
            No contact yet — this trade cannot receive an extract.
          </li>
        ) : (
          entry.contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">
                  {contact.name}
                  {contact.isPrimary ? (
                    <span className="ml-2 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
                      Primary
                    </span>
                  ) : null}
                </p>
                <p className="break-all text-sm text-muted-foreground">
                  {contact.email ?? "No email address"}
                  {contact.phone ? ` · ${contact.phone}` : ""}
                </p>
              </div>
              {!contact.isPrimary ? (
                <Button
                  variant="quiet"
                  className="min-h-11"
                  onClick={() =>
                    void onUpdateContact(
                      contact.id,
                      { isPrimary: true },
                      `${contact.name} is now the primary contact for ${entry.trade}`,
                    )
                  }
                >
                  Make primary
                </Button>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={contact.receivesCopies}
                  onChange={(event) =>
                    void onUpdateContact(
                      contact.id,
                      { receivesCopies: event.target.checked },
                      event.target.checked
                        ? `${contact.name} will be copied in`
                        : `${contact.name} will no longer be copied in`,
                    )
                  }
                />
                Copy in
              </label>
              <Button
                variant="quiet"
                className="min-h-11"
                onClick={() => void onDeleteContact(contact.id, contact.name)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                <span className="sr-only">Remove {contact.name}</span>
              </Button>
            </li>
          ))
        )}
      </ul>

      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (contactName.trim() === "" && contactEmail.trim() === "") return;
          void onAddContact({
            name: contactName,
            email: contactEmail || null,
            phone: contactPhone || null,
            isPrimary: entry.contacts.length === 0,
          }).then(() => {
            setContactName("");
            setContactEmail("");
            setContactPhone("");
          });
        }}
      >
        <label className="sr-only" htmlFor={`name-${entry.id}`}>
          Contact name for {entry.trade}
        </label>
        <input
          id={`name-${entry.id}`}
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          placeholder="Contact name"
          className="min-h-11 rounded-md border border-input bg-surface-raised p-2 text-base"
        />
        <label className="sr-only" htmlFor={`email-${entry.id}`}>
          Email address for {entry.trade}
        </label>
        <input
          id={`email-${entry.id}`}
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="Email address"
          className="min-h-11 rounded-md border border-input bg-surface-raised p-2 text-base"
        />
        <label className="sr-only" htmlFor={`phone-${entry.id}`}>
          Telephone for {entry.trade}
        </label>
        <input
          id={`phone-${entry.id}`}
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
          placeholder="Telephone"
          className="min-h-11 rounded-md border border-input bg-surface-raised p-2 text-base"
        />
        <Button type="submit" variant="quiet" className="min-h-11">
          <Plus aria-hidden="true" className="size-4" />
          Add contact
        </Button>
      </form>
    </li>
  );
}

function AddEntryDialog({
  onSubmit,
}: {
  onSubmit: (values: { trade: string; company: string; notes: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [trade, setTrade] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" className="min-h-11">
          <Plus aria-hidden="true" className="size-4" />
          Add a trade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a trade to this project</DialogTitle>
          <DialogDescription>
            The trade name is what findings are assigned to, so keep it consistent across projects.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="new-trade" className="eyebrow block text-muted-foreground">
              Trade
            </label>
            <input
              id="new-trade"
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="new-company" className="eyebrow block text-muted-foreground">
              Company
            </label>
            <input
              id="new-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="new-notes" className="eyebrow block text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              id="new-notes"
              value={notes}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={trade.trim() === "" || company.trim() === ""}
            onClick={() => {
              void onSubmit({ trade, company, notes: notes || null }).then(() => {
                setTrade("");
                setCompany("");
                setNotes("");
                setOpen(false);
              });
            }}
          >
            Add trade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  onImport,
}: {
  onImport: (groups: ReturnType<typeof groupImportRows>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => (result ? groupImportRows(result) : []), [result]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" className="min-h-11">
          <Upload aria-hidden="true" className="size-4" />
          Import a spreadsheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Columns: trade, company, contact, email, phone. Every row is checked and shown before
            anything is saved — nothing is skipped quietly.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setResult(parseDirectoryCsv(await file.text()));
          }}
        />

        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">What the file should look like</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 text-xs">
            {CSV_TEMPLATE}
          </pre>
        </details>

        {result?.fatal ? (
          <p role="alert" className="rounded-lg border border-fail/40 bg-fail-soft px-3 py-2 text-sm text-fail">
            {result.fatal}
          </p>
        ) : null}

        {result && !result.fatal ? (
          <div>
            <p className="text-sm font-semibold">
              {result.validCount} row{result.validCount === 1 ? "" : "s"} ready
              {result.invalidCount > 0 ? `, ${result.invalidCount} with problems` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {result.rows.map((row) => (
                <li
                  key={row.line}
                  className={
                    "rounded-lg border px-3 py-2 " +
                    (row.valid ? "border-border bg-surface" : "border-fail/40 bg-fail-soft")
                  }
                >
                  <span className="font-medium">Line {row.line}:</span>{" "}
                  {row.row.trade || "—"} · {row.row.company || "—"} · {row.row.email || "—"}
                  {!row.valid ? (
                    <ul className="mt-1 list-disc pl-5 text-fail">
                      {row.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!result || !!result.fatal || result.validCount === 0}
            onClick={() => {
              void onImport(groups).then(() => {
                setResult(null);
                if (fileRef.current) fileRef.current.value = "";
                setOpen(false);
              });
            }}
          >
            Import {result?.validCount ?? 0} valid row
            {(result?.validCount ?? 0) === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyDialog({
  projects,
  onCopy,
}: {
  projects: Array<{ id: string; name: string; reference: string | null }>;
  onCopy: (projectId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" className="min-h-11">
          <Copy aria-hidden="true" className="size-4" />
          Copy from another project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy a directory</DialogTitle>
          <DialogDescription>
            Entries and contacts are copied across. Nothing on the other project changes.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="copy-source" className="eyebrow block text-muted-foreground">
          Project
        </label>
        <select
          id="copy-source"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
        >
          <option value="">Choose a project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.reference ? `${project.reference} — ` : ""}
              {project.name}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={chosen === ""}
            onClick={() => {
              void onCopy(chosen).then(() => {
                setChosen("");
                setOpen(false);
              });
            }}
          >
            Copy directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  templates,
  canSave,
  onApply,
  onSave,
}: {
  templates: Array<{ id: string; name: string; entries: unknown[] }>;
  canSave: boolean;
  onApply: (template: any) => Promise<void>;
  onSave: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" className="min-h-11">
          <Contact aria-hidden="true" className="size-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Organisation templates</DialogTitle>
          <DialogDescription>
            A saved list of regular subcontractors, so it is not retyped on every project.
          </DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates saved yet.</p>
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3"
              >
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {template.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {template.entries.length} trade
                    {template.entries.length === 1 ? "" : "s"}
                  </span>
                </span>
                <Button
                  variant="quiet"
                  className="min-h-11"
                  onClick={() => void onApply(template).then(() => setOpen(false))}
                >
                  Apply to this project
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="rule-top pt-3">
          <label htmlFor="template-name" className="eyebrow block text-muted-foreground">
            Save this project&rsquo;s directory as a template
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example, Standard subcontractors"
              className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-surface-raised p-2 text-base"
            />
            <Button
              variant="brand"
              className="min-h-11"
              disabled={!canSave || name.trim() === ""}
              onClick={() => {
                void onSave(name.trim()).then(() => setName(""));
              }}
            >
              <Save aria-hidden="true" className="size-4" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
