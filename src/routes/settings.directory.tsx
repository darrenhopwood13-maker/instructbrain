import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { directory } from "@/lib/mock-data";

export const Route = createFileRoute("/settings/directory")({
  head: () => ({
    meta: [
      { title: "Project directory — Report Ready" },
      {
        name: "description",
        content:
          "Trades, companies and contacts used to distribute per-trade report extracts to subcontractors.",
      },
      { property: "og:title", content: "Project directory — Report Ready" },
      {
        property: "og:description",
        content: "Trades, companies and contacts for per-trade report distribution.",
      },
    ],
  }),
  component: DirectorySettings,
});

function DirectorySettings() {
  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="eyebrow">Settings</p>
          <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
            Project directory
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Placeholder directory. Per-trade extracts will be distributed to these contacts when a
            report is issued.
          </p>
        </div>
        <Button variant="brand" className="shrink-0">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">Add contact</span>
          <span className="sr-only sm:hidden">Add contact</span>
        </Button>
      </header>

      {/* Cards on mobile, table from md up — both read from the same mock rows. */}
      <ul className="mt-6 space-y-3 md:hidden">
        {directory.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
          >
            <p className="eyebrow">{entry.trade}</p>
            <p className="mt-1 font-semibold">{entry.company}</p>
            <p className="mt-1 text-sm text-muted-foreground">{entry.contact}</p>
            <a
              href={`mailto:${entry.email}`}
              className="mt-2 block break-all text-sm font-medium text-brand-blue-ink underline underline-offset-2"
            >
              {entry.email}
            </a>
            <a
              href={`tel:${entry.phone.replace(/\s/g, "")}`}
              className="mt-1 block text-sm font-medium text-brand-blue-ink underline underline-offset-2"
            >
              {entry.phone}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-6 hidden overflow-hidden rounded-xl border border-border bg-surface-raised md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Subcontractor directory listing trade, company and contact details
          </caption>
          <thead className="bg-surface-sunken">
            <tr>
              {["Trade", "Company", "Contact", "Email", "Telephone"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {directory.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-sunken">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {entry.trade}
                </th>
                <td className="px-4 py-3">{entry.company}</td>
                <td className="px-4 py-3">{entry.contact}</td>
                <td className="px-4 py-3">
                  <a
                    href={`mailto:${entry.email}`}
                    className="text-brand-blue-ink underline underline-offset-2"
                  >
                    {entry.email}
                  </a>
                </td>
                <td className="px-4 py-3 tabular-nums">{entry.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
