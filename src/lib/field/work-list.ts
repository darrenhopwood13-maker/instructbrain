/**
 * What the person on site is meant to be doing today.
 *
 * The field app could photograph, but it could not tell you what to photograph. A rota of
 * weekly checks lived on the desk screen; the person holding the phone had to remember it
 * or ring somebody. This is the list, in the order a working day actually goes: the thing
 * that was due last week first, then today, then the rest of the week.
 *
 * A check is due on the week it covers - `check_date` - and it stops being work the moment
 * it is locked. Nothing is invented: if nobody has scheduled a check, the list says so
 * rather than filling the space with a suggestion.
 */

import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FieldWorkItem = {
  /** The compliance run id. */
  id: string;
  projectId: string;
  projectName: string;
  checkType: string;
  /** The week the check belongs to, as YYYY-MM-DD. */
  dueOn: string;
  /** Set when this run is already partly done, so the row can say so. */
  confirmedCount?: number;
};

export type FieldWorkBuckets = {
  overdue: FieldWorkItem[];
  dueToday: FieldWorkItem[];
  thisWeek: FieldWorkItem[];
  later: FieldWorkItem[];
};

const DAY = 24 * 60 * 60 * 1000;

/** A date as YYYY-MM-DD in the viewer's own timezone, which is the one the site works in. */
export function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00`);
  return isoDate(new Date(base.getTime() + days * DAY));
}

/**
 * Split the list by how late it is. Dates are compared as `YYYY-MM-DD` strings: no
 * timezone arithmetic, so a check due today is never "tomorrow" because the server is on
 * UTC and the site is not.
 */
export function bucketWork(items: FieldWorkItem[], today: string): FieldWorkBuckets {
  const weekEnd = shiftDays(today, 7);
  const buckets: FieldWorkBuckets = { overdue: [], dueToday: [], thisWeek: [], later: [] };
  for (const item of items) {
    if (item.dueOn < today) buckets.overdue.push(item);
    else if (item.dueOn === today) buckets.dueToday.push(item);
    else if (item.dueOn <= weekEnd) buckets.thisWeek.push(item);
    else buckets.later.push(item);
  }
  // Most overdue first; everything else by the week it belongs to.
  buckets.overdue.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  buckets.thisWeek.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  buckets.later.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return buckets;
}

/** How many days a check is past its week. 0 when it is not late. */
export function overdueDays(item: { dueOn: string }, today: string): number {
  if (item.dueOn >= today) return 0;
  const due = new Date(`${item.dueOn}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - due) / DAY));
}

/**
 * One line for the top of the screen. Says the two things that change a decision: how much
 * is late, and how much is for today. Silence when there is nothing to say.
 */
export function summariseWork(buckets: FieldWorkBuckets, today: string): string {
  const parts: string[] = [];
  if (buckets.overdue.length > 0) {
    const worst = buckets.overdue.reduce(
      (most, item) => Math.max(most, overdueDays(item, today)),
      0,
    );
    parts.push(
      `${buckets.overdue.length} overdue${worst > 0 ? ` by up to ${worst} day${worst === 1 ? "" : "s"}` : ""}`,
    );
  }
  if (buckets.dueToday.length > 0) {
    parts.push(`${buckets.dueToday.length} due today`);
  }
  if (buckets.thisWeek.length > 0) {
    parts.push(`${buckets.thisWeek.length} later this week`);
  }
  return parts.join(", ");
}

/** Every bucket in the order the screen shows them, with its own heading. */
export function orderedBuckets(buckets: FieldWorkBuckets): { title: string; items: FieldWorkItem[] }[] {
  return [
    { title: "Overdue", items: buckets.overdue },
    { title: "Due today", items: buckets.dueToday },
    { title: "Later this week", items: buckets.thisWeek },
    { title: "Further ahead", items: buckets.later },
  ].filter((bucket) => bucket.items.length > 0);
}

/**
 * Open checks across every organisation the signed-in person belongs to.
 *
 * `compliance_runs` is not in the generated Database types yet, so the table is cast; the
 * same cast is used by the compliance data layer. Locked and archived runs are excluded in
 * the query rather than after it, because a completed check is deliberately not work.
 */
export function fieldWorkQuery(organisationIds: string[]) {
  const key = [...organisationIds].sort().join(",");
  return queryOptions({
    queryKey: ["field", "work", key],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<FieldWorkItem[]> => {
      if (organisationIds.length === 0) return [];
      const { data, error } = await (
        supabase.from("compliance_runs" as never) as unknown as {
          select: (columns: string) => {
            in: (column: string, values: string[]) => {
              is: (column: string, value: null) => {
                is: (column: string, value: null) => {
                  order: (column: string, options: { ascending: boolean }) => {
                    limit: (count: number) => Promise<{ data: unknown; error: Error | null }>;
                  };
                };
              };
            };
          };
        }
      )
        .select("id, project_id, check_type, check_date, projects(name)")
        .in("organisation_id", organisationIds)
        .is("locked_at", null)
        .is("archived_at", null)
        .order("check_date", { ascending: true })
        .limit(60);

      if (error) throw new Error(error.message);

      type Row = {
        id: string;
        project_id: string;
        check_type: string;
        check_date: string;
        projects: { name: string | null } | null;
      };
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.projects?.name ?? "No project",
        checkType: row.check_type,
        dueOn: String(row.check_date).slice(0, 10),
      }));
    },
  });
}
