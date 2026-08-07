import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataError } from "@/lib/data";
import type { GroupedImport } from "@/lib/directory/csv-import";

/**
 * The project directory: who is working on THIS project, and who receives
 * anything that is not assigned to a trade.
 *
 * A directory is per project. The organisation keeps reusable templates so a
 * regular subcontractor list is not retyped, but nothing is distributed from a
 * template — only from the project's own directory.
 */

function from(table: string) {
  return supabase.from(table as never) as unknown as {
    select: (columns?: string, options?: Record<string, unknown>) => any;
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => any;
    update: (values: Record<string, unknown>) => any;
    delete: () => any;
  };
}

function unwrap<T>(result: { data: T | null; error: any }): T {
  if (result.error) {
    throw new DataError(
      result.error.message,
      result.error.code,
      result.error.hint,
      result.error.details,
    );
  }
  return (result.data ?? []) as T;
}

function check(result: { error: any }): void {
  if (result.error) {
    throw new DataError(
      result.error.message,
      result.error.code,
      result.error.hint,
      result.error.details,
    );
  }
}

export type DirectoryContact = {
  id: string;
  directoryId: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  receivesCopies: boolean;
};

export type DirectoryEntryFull = {
  id: string;
  projectId: string;
  trade: string;
  company: string;
  notes: string | null;
  isActive: boolean;
  contacts: DirectoryContact[];
  /** The one contact an extract is addressed to, when there is one. */
  primary: DirectoryContact | null;
};

const contactColumns = "id, directory_id, name, email, phone, is_primary, receives_copies";

function toContact(row: Record<string, any>): DirectoryContact {
  return {
    id: row["id"] as string,
    directoryId: row["directory_id"] as string,
    name: (row["name"] as string) ?? "",
    email: (row["email"] as string | null) ?? null,
    phone: (row["phone"] as string | null) ?? null,
    isPrimary: row["is_primary"] === true,
    receivesCopies: row["receives_copies"] === true,
  };
}

export const projectDirectoryQuery = (projectId: string | null) =>
  queryOptions({
    queryKey: ["project-directory", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<DirectoryEntryFull[]> => {
      const rows = unwrap(
        await from("project_directory")
          .select("id, project_id, trade, company_name, notes, is_active")
          .eq("project_id", projectId)
          .order("trade", { ascending: true }),
      ) as Array<Record<string, any>>;
      if (rows.length === 0) return [];

      const contactRows = unwrap(
        await from("directory_contacts")
          .select(contactColumns)
          .in(
            "directory_id",
            rows.map((row) => row["id"]),
          )
          .order("is_primary", { ascending: false }),
      ) as Array<Record<string, any>>;

      return rows.map((row) => {
        const contacts = contactRows
          .filter((contact) => contact["directory_id"] === row["id"])
          .map(toContact);
        return {
          id: row["id"] as string,
          projectId: row["project_id"] as string,
          trade: row["trade"] as string,
          company: (row["company_name"] as string) ?? "",
          notes: (row["notes"] as string | null) ?? null,
          isActive: row["is_active"] !== false,
          contacts,
          primary: contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null,
        };
      });
    },
  });

/* ------------------------------------------------------------------ */
/* Entries                                                              */
/* ------------------------------------------------------------------ */

export async function createDirectoryEntry(input: {
  projectId: string;
  trade: string;
  company: string;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await from("project_directory")
    .insert({
      project_id: input.projectId,
      trade: input.trade.trim(),
      company_name: input.company.trim(),
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  return (data as { id: string }).id;
}

export async function updateDirectoryEntry(
  entryId: string,
  patch: { trade?: string; company?: string; notes?: string | null; isActive?: boolean },
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.trade !== undefined) values["trade"] = patch.trade.trim();
  if (patch.company !== undefined) values["company_name"] = patch.company.trim();
  if (patch.notes !== undefined) values["notes"] = patch.notes?.trim() || null;
  if (patch.isActive !== undefined) values["is_active"] = patch.isActive;
  if (Object.keys(values).length === 0) return;
  check(await from("project_directory").update(values).eq("id", entryId));
}

export async function deleteDirectoryEntry(entryId: string): Promise<void> {
  check(await from("directory_contacts").delete().eq("directory_id", entryId));
  check(await from("project_directory").delete().eq("id", entryId));
}

/* ------------------------------------------------------------------ */
/* Contacts                                                             */
/* ------------------------------------------------------------------ */

/**
 * Exactly one primary per trade. Promoting a contact demotes every sibling in
 * the same entry first, so an extract is never addressed twice.
 */
async function demoteSiblings(directoryId: string, exceptId?: string): Promise<void> {
  const query = from("directory_contacts")
    .update({ is_primary: false })
    .eq("directory_id", directoryId);
  check(await (exceptId ? query.neq("id", exceptId) : query));
}

export async function addDirectoryContact(input: {
  directoryId: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  receivesCopies?: boolean;
}): Promise<string> {
  if (input.isPrimary) await demoteSiblings(input.directoryId);
  const { data, error } = await from("directory_contacts")
    .insert({
      directory_id: input.directoryId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      is_primary: input.isPrimary,
      receives_copies: input.receivesCopies ?? false,
    })
    .select("id")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  return (data as { id: string }).id;
}

export async function updateDirectoryContact(
  contactId: string,
  directoryId: string,
  patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    isPrimary?: boolean;
    receivesCopies?: boolean;
  },
): Promise<void> {
  if (patch.isPrimary === true) await demoteSiblings(directoryId, contactId);
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values["name"] = patch.name.trim();
  if (patch.email !== undefined) values["email"] = patch.email?.trim() || null;
  if (patch.phone !== undefined) values["phone"] = patch.phone?.trim() || null;
  if (patch.isPrimary !== undefined) values["is_primary"] = patch.isPrimary;
  if (patch.receivesCopies !== undefined) values["receives_copies"] = patch.receivesCopies;
  if (Object.keys(values).length === 0) return;
  check(await from("directory_contacts").update(values).eq("id", contactId));
}

export async function deleteDirectoryContact(contactId: string): Promise<void> {
  check(await from("directory_contacts").delete().eq("id", contactId));
}

/* ------------------------------------------------------------------ */
/* Fallback recipient                                                   */
/* ------------------------------------------------------------------ */

export type FallbackRecipient = { name: string | null; email: string | null };

export const fallbackRecipientQuery = (projectId: string | null) =>
  queryOptions({
    queryKey: ["fallback-recipient", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<FallbackRecipient> => {
      const rows = unwrap(
        await from("projects")
          .select("fallback_recipient_name, fallback_recipient_email, principal_contractor")
          .eq("id", projectId)
          .limit(1),
      ) as Array<Record<string, any>>;
      const row = rows[0];
      return {
        name: (row?.["fallback_recipient_name"] as string | null) ?? null,
        email: (row?.["fallback_recipient_email"] as string | null) ?? null,
      };
    },
  });

export async function updateFallbackRecipient(
  projectId: string,
  value: FallbackRecipient,
): Promise<void> {
  check(
    await from("projects")
      .update({
        fallback_recipient_name: value.name?.trim() || null,
        fallback_recipient_email: value.email?.trim() || null,
      })
      .eq("id", projectId),
  );
}

/** Distribution is blocked until someone owns the unassigned items. */
export function fallbackIsSet(value: FallbackRecipient | null | undefined): boolean {
  return !!value?.email && value.email.includes("@");
}

/* ------------------------------------------------------------------ */
/* Copy from another project                                            */
/* ------------------------------------------------------------------ */

export const copyableProjectsQuery = (organisationIds: string[], excludeProjectId: string) =>
  queryOptions({
    queryKey: ["copyable-projects", [...organisationIds].sort(), excludeProjectId],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<Array<{ id: string; name: string; reference: string | null }>> => {
      const rows = unwrap(
        await from("projects")
          .select("id, name, reference")
          .in("organisation_id", organisationIds)
          .neq("id", excludeProjectId)
          .order("created_at", { ascending: false }),
      ) as Array<{ id: string; name: string; reference: string | null }>;
      return rows;
    },
  });

export async function copyDirectoryFromProject(
  sourceProjectId: string,
  targetProjectId: string,
): Promise<number> {
  const source = unwrap(
    await from("project_directory")
      .select("id, trade, company_name, notes, is_active")
      .eq("project_id", sourceProjectId),
  ) as Array<Record<string, any>>;
  if (source.length === 0) return 0;

  const contacts = unwrap(
    await from("directory_contacts")
      .select(contactColumns)
      .in(
        "directory_id",
        source.map((row) => row["id"]),
      ),
  ) as Array<Record<string, any>>;

  let copied = 0;
  for (const entry of source) {
    const newId = await createDirectoryEntry({
      projectId: targetProjectId,
      trade: entry["trade"] as string,
      company: (entry["company_name"] as string) ?? "",
      notes: (entry["notes"] as string | null) ?? null,
    });
    const rows = contacts
      .filter((contact) => contact["directory_id"] === entry["id"])
      .map((contact) => ({
        directory_id: newId,
        name: contact["name"],
        email: contact["email"],
        phone: contact["phone"],
        is_primary: contact["is_primary"] === true,
        receives_copies: contact["receives_copies"] === true,
      }));
    if (rows.length > 0) check(await from("directory_contacts").insert(rows));
    copied += 1;
  }
  return copied;
}

/* ------------------------------------------------------------------ */
/* CSV import                                                           */
/* ------------------------------------------------------------------ */

export async function importDirectoryGroups(
  projectId: string,
  groups: GroupedImport[],
): Promise<number> {
  let imported = 0;
  for (const group of groups) {
    const entryId = await createDirectoryEntry({
      projectId,
      trade: group.trade,
      company: group.company,
    });
    const rows = group.contacts.map((contact, index) => ({
      directory_id: entryId,
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      is_primary: index === 0,
      receives_copies: false,
    }));
    if (rows.length > 0) check(await from("directory_contacts").insert(rows));
    imported += rows.length;
  }
  return imported;
}

/* ------------------------------------------------------------------ */
/* Organisation templates                                               */
/* ------------------------------------------------------------------ */

export type TemplateContact = { name: string; email: string | null; phone: string | null; isPrimary: boolean };

export type DirectoryTemplateEntry = {
  id: string;
  trade: string;
  company: string;
  notes: string | null;
  contacts: TemplateContact[];
};

export type DirectoryTemplate = {
  id: string;
  name: string;
  createdAt: string;
  entries: DirectoryTemplateEntry[];
};

function toTemplateContacts(value: unknown): TemplateContact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: typeof item["name"] === "string" ? item["name"] : "",
      email: typeof item["email"] === "string" ? item["email"] : null,
      phone: typeof item["phone"] === "string" ? item["phone"] : null,
      isPrimary: item["isPrimary"] === true,
    }));
}

export const directoryTemplatesQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["directory-templates", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<DirectoryTemplate[]> => {
      const templates = unwrap(
        await from("directory_templates")
          .select("id, name, created_at")
          .in("organisation_id", organisationIds)
          .order("created_at", { ascending: false }),
      ) as Array<Record<string, any>>;
      if (templates.length === 0) return [];

      const entries = unwrap(
        await from("directory_template_entries")
          .select("id, template_id, trade, company_name, notes, contacts")
          .in(
            "template_id",
            templates.map((template) => template["id"]),
          )
          .order("trade", { ascending: true }),
      ) as Array<Record<string, any>>;

      return templates.map((template) => ({
        id: template["id"] as string,
        name: template["name"] as string,
        createdAt: template["created_at"] as string,
        entries: entries
          .filter((entry) => entry["template_id"] === template["id"])
          .map((entry) => ({
            id: entry["id"] as string,
            trade: entry["trade"] as string,
            company: (entry["company_name"] as string) ?? "",
            notes: (entry["notes"] as string | null) ?? null,
            contacts: toTemplateContacts(entry["contacts"]),
          })),
      }));
    },
  });

export async function saveDirectoryAsTemplate(input: {
  organisationId: string;
  name: string;
  entries: DirectoryEntryFull[];
}): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await from("directory_templates")
    .insert({
      organisation_id: input.organisationId,
      name: input.name.trim(),
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  const templateId = (data as { id: string }).id;

  const rows = input.entries.map((entry) => ({
    template_id: templateId,
    trade: entry.trade,
    company_name: entry.company,
    notes: entry.notes,
    contacts: entry.contacts.map((contact) => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    })),
  }));
  if (rows.length > 0) check(await from("directory_template_entries").insert(rows));
  return templateId;
}

export async function applyDirectoryTemplate(
  template: DirectoryTemplate,
  projectId: string,
): Promise<number> {
  let applied = 0;
  for (const entry of template.entries) {
    const entryId = await createDirectoryEntry({
      projectId,
      trade: entry.trade,
      company: entry.company,
      notes: entry.notes,
    });
    const rows = entry.contacts.map((contact, index) => ({
      directory_id: entryId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      is_primary: contact.isPrimary || index === 0,
      receives_copies: false,
    }));
    if (rows.length > 0) check(await from("directory_contacts").insert(rows));
    applied += 1;
  }
  return applied;
}

export async function deleteDirectoryTemplate(templateId: string): Promise<void> {
  check(await from("directory_template_entries").delete().eq("template_id", templateId));
  check(await from("directory_templates").delete().eq("id", templateId));
}
