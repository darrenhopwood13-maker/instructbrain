/**
 * The weekly compliance pack.
 *
 * One PDF a site manager can hand to a client or an inspector: the register
 * grid, every point with its answers and its photograph, the actions schedule
 * and the close-out evidence. Nothing is omitted — a missing photograph is
 * printed as missing.
 *
 * Runs in the serverless worker, so pure pdf-lib. Photographs are fetched from
 * storage exactly as stored; nothing here touches the analysis path.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";
import {
  checkType,
  fieldsForUnitType,
  derivedDueDate,
  type ComplianceStatus,
} from "@/lib/compliance/checks";
import {
  CELL_LABELS,
  buildRegister,
  isActionOverdue,
  photoMissing,
  registerWeeks,
  type RegisterModel,
} from "@/lib/compliance/register";
import type {
  ComplianceAction,
  ComplianceEntry,
  CompliancePoint,
  ComplianceRun,
} from "@/lib/compliance/compliance-data";

type Db = SupabaseClient<any, any, any>;

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 44;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

const INK = rgb(0.06, 0.11, 0.2);
const MUTED = rgb(0.35, 0.39, 0.47);
const RULE = rgb(0.85, 0.87, 0.91);
const ACCENT = rgb(1, 0.37, 0);

const PHOTO_BUDGET_BYTES = 14 * 1024 * 1024;

type Writer = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  footer: string;
};

function newPage(writer: Writer) {
  writer.page = writer.doc.addPage([A4.width, A4.height]);
  writer.y = A4.height - MARGIN;
}

function ensure(writer: Writer, needed: number) {
  if (writer.y - needed < MARGIN + 26) newPage(writer);
}

function sanitise(value: string): string {
  return (value ?? "")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitise(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

function text(
  writer: Writer,
  value: string,
  options: {
    size?: number;
    bold?: boolean;
    colour?: ReturnType<typeof rgb>;
    x?: number;
    width?: number;
    gapAfter?: number;
  } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.regular;
  const width = options.width ?? CONTENT_WIDTH;
  const x = options.x ?? MARGIN;
  const lineHeight = size + 3;
  for (const line of wrap(value, font, size, width)) {
    ensure(writer, lineHeight);
    writer.page.drawText(line, { x, y: writer.y - size, size, font, color: options.colour ?? INK });
    writer.y -= lineHeight;
  }
  writer.y -= options.gapAfter ?? 0;
}

function rule(writer: Writer, before = 8, after = 8) {
  ensure(writer, before + after + 2);
  writer.y -= before;
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y },
    end: { x: A4.width - MARGIN, y: writer.y },
    thickness: 0.75,
    color: RULE,
  });
  writer.y -= after;
}

function eyebrow(writer: Writer, value: string) {
  text(writer, value.toUpperCase(), { size: 8, bold: true, colour: ACCENT, gapAfter: 2 });
}

function fact(writer: Writer, label: string, value: string) {
  if (!value) return;
  ensure(writer, 14);
  writer.page.drawText(sanitise(label), {
    x: MARGIN,
    y: writer.y - 9,
    size: 9,
    font: writer.bold,
    color: MUTED,
  });
  const lines = wrap(value, writer.regular, 10, CONTENT_WIDTH - 120);
  lines.forEach((line, index) => {
    writer.page.drawText(line, {
      x: MARGIN + 120,
      y: writer.y - 9 - index * 12,
      size: 10,
      font: writer.regular,
      color: INK,
    });
  });
  writer.y -= 12 * lines.length + 2;
}

/* ------------------------------------------------------------------ */
/* Loading                                                              */
/* ------------------------------------------------------------------ */

export type PackData = {
  project: { name: string; reference: string | null; clientName: string | null; address: string | null } | null;
  organisationName: string;
  runs: ComplianceRun[];
  points: CompliancePoint[];
  entries: ComplianceEntry[];
  actions: ComplianceAction[];
  photoUrls: Map<string, string>;
  photoCaptured: Map<string, string | null>;
};

function mapRun(row: Record<string, any>): ComplianceRun {
  return {
    id: row["id"],
    organisationId: row["organisation_id"],
    projectId: row["project_id"],
    checkType: row["check_type"],
    checkDate: row["check_date"],
    siteReference: row["site_reference"] ?? null,
    reportNumber: row["report_number"] ?? null,
    performedByName: row["performed_by_name"] ?? null,
    signedAt: row["signed_at"] ?? null,
    competentPerson: row["competent_person"] ?? null,
    lockedAt: row["locked_at"] ?? null,
    reportId: row["report_id"] ?? null,
    createdAt: row["created_at"],
  };
}

export async function loadPackData(
  db: Db,
  input: { projectId: string; checkType: string; runId?: string | null },
): Promise<PackData> {
  const [{ data: projectRow }, { data: runRows }, { data: pointRows }, { data: actionRows }] =
    await Promise.all([
      db
        .from("projects")
        .select("name, reference, client_name, address, organisation_id")
        .eq("id", input.projectId)
        .maybeSingle(),
      db
        .from("compliance_runs")
        .select(
          "id, organisation_id, project_id, check_type, check_date, site_reference, report_number, performed_by_name, signed_at, competent_person, locked_at, report_id, created_at",
        )
        .eq("project_id", input.projectId)
        .eq("check_type", input.checkType)
        .order("check_date", { ascending: false })
        .limit(24),
      db
        .from("compliance_points")
        .select(
          "id, project_id, check_type, location, unit_ref, unit_type, state, decommissioned_at, decommission_note",
        )
        .eq("project_id", input.projectId)
        .eq("check_type", input.checkType),
      db
        .from("compliance_actions")
        .select(
          "id, project_id, point_id, raised_run_id, description, owner, opened_on, target_date, status, closed_on, closeout_photo_id, closeout_note",
        )
        .eq("project_id", input.projectId)
        .order("opened_on", { ascending: true }),
    ]);

  const allRuns = ((runRows ?? []) as Record<string, any>[]).map(mapRun);
  const runs = input.runId
    ? allRuns.filter((run) => run.id === input.runId)
    : registerWeeks(allRuns);

  const runIds = runs.map((run) => run.id);
  const { data: entryRows } = runIds.length
    ? await db
        .from("compliance_entries")
        .select("id, run_id, point_id, answers, status, na_reason, note, photo_id, confirmed")
        .in("run_id", runIds)
    : { data: [] as Record<string, any>[] };

  const entries: ComplianceEntry[] = ((entryRows ?? []) as Record<string, any>[]).map((row) => ({
    id: row["id"],
    runId: row["run_id"],
    pointId: row["point_id"],
    answers: (row["answers"] ?? {}) as Record<string, unknown>,
    status: (row["status"] ?? "not_applicable") as ComplianceStatus,
    naReason: row["na_reason"] ?? null,
    note: row["note"] ?? null,
    photoId: row["photo_id"] ?? null,
    confirmed: row["confirmed"] === true,
  }));

  const points: CompliancePoint[] = ((pointRows ?? []) as Record<string, any>[]).map((row) => ({
    id: row["id"],
    projectId: row["project_id"],
    checkType: row["check_type"],
    location: row["location"] ?? "",
    unitRef: row["unit_ref"] ?? "",
    unitType: row["unit_type"] ?? null,
    state: row["state"] === "decommissioned" ? "decommissioned" : "active",
    decommissionedAt: row["decommissioned_at"] ?? null,
    decommissionNote: row["decommission_note"] ?? null,
  }));

  const actions: ComplianceAction[] = ((actionRows ?? []) as Record<string, any>[]).map((row) => ({
    id: row["id"],
    projectId: row["project_id"],
    pointId: row["point_id"] ?? null,
    raisedRunId: row["raised_run_id"] ?? null,
    description: row["description"] ?? "",
    owner: row["owner"] ?? null,
    openedOn: row["opened_on"],
    targetDate: row["target_date"] ?? null,
    status: (row["status"] ?? "open") as ComplianceAction["status"],
    closedOn: row["closed_on"] ?? null,
    closeoutPhotoId: row["closeout_photo_id"] ?? null,
    closeoutNote: row["closeout_note"] ?? null,
  }));

  const photoIds = [
    ...new Set(
      [
        ...entries.map((entry) => entry.photoId),
        ...actions.map((action) => action.closeoutPhotoId),
      ].filter((value): value is string => !!value),
    ),
  ];

  const photoUrls = new Map<string, string>();
  const photoCaptured = new Map<string, string | null>();
  if (photoIds.length > 0) {
    const { data: photoRows } = await db
      .from("photos")
      .select("id, storage_path, thumbnail_path, captured_at")
      .in("id", photoIds);
    const rows = (photoRows ?? []) as Record<string, any>[];
    const paths = rows
      .map((row) => (row["storage_path"] ?? row["thumbnail_path"]) as string | null)
      .filter((path): path is string => !!path);
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data } = await db.storage.from(PHOTO_BUCKET).createSignedUrls([...new Set(paths)], 900);
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      }
    }
    for (const row of rows) {
      const path = (row["storage_path"] ?? row["thumbnail_path"]) as string | null;
      const url = path ? signed.get(path) : undefined;
      if (url) photoUrls.set(row["id"], url);
      photoCaptured.set(row["id"], row["captured_at"] ?? null);
    }
  }

  const organisationId = (projectRow as Record<string, any> | null)?.["organisation_id"] ?? null;
  let organisationName = "";
  if (organisationId) {
    const { data: org } = await db
      .from("organisations")
      .select("name")
      .eq("id", organisationId)
      .maybeSingle();
    organisationName = (org as Record<string, any> | null)?.["name"] ?? "";
  }

  const project = projectRow as Record<string, any> | null;
  return {
    project: project
      ? {
          name: project["name"] ?? "",
          reference: project["reference"] ?? null,
          clientName: project["client_name"] ?? null,
          address: project["address"] ?? null,
        }
      : null,
    organisationName,
    runs,
    points,
    entries,
    actions,
    photoUrls,
    photoCaptured,
  };
}

/* ------------------------------------------------------------------ */
/* Photographs                                                          */
/* ------------------------------------------------------------------ */

function imageKind(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return null;
}

type Fetcher = { spent: number; cache: Map<string, PDFImage | null> };

async function embed(writer: Writer, fetcher: Fetcher, photoId: string, url: string | undefined) {
  if (fetcher.cache.has(photoId)) return fetcher.cache.get(photoId) ?? null;
  let image: PDFImage | null = null;
  if (url && fetcher.spent < PHOTO_BUDGET_BYTES) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const kind = imageKind(bytes);
        if (kind) {
          image = kind === "jpg" ? await writer.doc.embedJpg(bytes) : await writer.doc.embedPng(bytes);
          fetcher.spent += bytes.byteLength;
        }
      }
    } catch {
      /* an unreadable object is recorded as missing, never fatal */
    }
  }
  fetcher.cache.set(photoId, image);
  return image;
}

function drawImage(writer: Writer, image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  ensure(writer, height + 8);
  writer.page.drawImage(image, { x: MARGIN, y: writer.y - height, width, height });
  writer.y -= height + 8;
}

/* ------------------------------------------------------------------ */
/* The pack                                                             */
/* ------------------------------------------------------------------ */

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function answerText(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "Not answered";
  return String(value);
}

export function packFilename(input: {
  checkTypeLabel: string;
  projectName: string;
  weekEnding: string | null;
  single: boolean;
}): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "site";
  const scope = input.single ? input.weekEnding ?? "week" : "six-weeks";
  return `compliance-pack-${slug(input.checkTypeLabel)}-${slug(input.projectName)}-${scope}.pdf`;
}

export async function buildCompliancePack(
  data: PackData,
  input: { checkType: string; single: boolean },
): Promise<{ bytes: Uint8Array; filename: string }> {
  const definition = checkType(input.checkType);
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const projectName = data.project?.name ?? "Site";

  const writer: Writer = {
    doc,
    regular,
    bold,
    page: doc.addPage([A4.width, A4.height]),
    y: A4.height - MARGIN,
    footer: `${projectName} - ${definition.label} weekly compliance register`,
  };

  const model: RegisterModel = buildRegister({
    checkTypeId: input.checkType,
    runs: data.runs,
    points: data.points,
    entries: data.entries,
    actions: data.actions,
  });

  const latest = [...data.runs].sort((a, b) => b.checkDate.localeCompare(a.checkDate))[0] ?? null;
  const weekEnding = latest?.checkDate ?? null;

  /* Cover ---------------------------------------------------------- */
  eyebrow(writer, "Weekly compliance register");
  text(writer, `${definition.label} checks`, { size: 22, bold: true, gapAfter: 2 });
  text(
    writer,
    input.single
      ? `Week ending ${formatDate(weekEnding)}`
      : `The last ${model.weeks.length} week(s) of record`,
    { size: 12, colour: MUTED, gapAfter: 4 },
  );
  rule(writer, 8, 10);

  fact(writer, "Site", projectName);
  fact(writer, "Client", data.project?.clientName ?? "");
  fact(writer, "Address", data.project?.address ?? "");
  fact(writer, "Site reference", latest?.siteReference ?? data.project?.reference ?? "");
  fact(writer, "Report number", latest?.reportNumber ?? "");
  fact(writer, "Performed by", latest?.performedByName ?? "Not yet signed");
  if (definition.requiresCompetentPerson) {
    fact(writer, "Competent person", latest?.competentPerson ?? "Not recorded");
  }
  fact(writer, "Prepared by", data.organisationName);
  fact(writer, "Pack produced", formatDate(new Date().toISOString()));

  rule(writer, 10, 10);
  const totals = model.weeks.reduce(
    (sum, week) => ({
      checked: sum.checked + week.checked,
      nonCompliant: sum.nonCompliant + week.nonCompliant,
      photosMissing: sum.photosMissing + week.photosMissing,
    }),
    { checked: 0, nonCompliant: 0, photosMissing: 0 },
  );
  fact(writer, "Points recorded", String(totals.checked));
  fact(writer, "Non-compliant", String(totals.nonCompliant));
  fact(writer, "Photographs missing", String(totals.photosMissing));
  fact(writer, "Actions open", String(model.actions.open));
  fact(writer, "Actions overdue", String(model.actions.overdue));

  /* Register grid --------------------------------------------------- */
  newPage(writer);
  eyebrow(writer, input.single ? "This week" : "The register");
  text(writer, "Point by point, week by week", { size: 14, bold: true, gapAfter: 6 });

  if (model.rows.length === 0) {
    text(writer, "No points have been recorded for this check type yet.", {
      size: 10,
      colour: MUTED,
    });
  } else {
    for (const row of model.rows) {
      ensure(writer, 34);
      const heading = `${row.point.location} - ${row.point.unitRef}${
        row.point.unitType ? ` (${row.point.unitType})` : ""
      }`;
      text(writer, heading, { size: 10, bold: true });
      if (row.point.state === "decommissioned") {
        text(
          writer,
          `Decommissioned ${formatDate(row.point.decommissionedAt)}${
            row.point.decommissionNote ? ` - ${row.point.decommissionNote}` : ""
          }`,
          { size: 9, colour: MUTED },
        );
      }
      for (const [index, cell] of row.cells.entries()) {
        const week = model.weeks[index];
        text(
          writer,
          `${formatDate(week?.run.checkDate ?? null)}: ${cell.label}${
            cell.photoMissing ? " - photograph missing" : ""
          }${cell.note ? ` - ${cell.note}` : ""}`,
          { size: 9, colour: MUTED, x: MARGIN + 12, width: CONTENT_WIDTH - 12 },
        );
      }
      rule(writer, 4, 6);
    }
  }

  /* Point detail with photographs ----------------------------------- */
  const fetcher: Fetcher = { spent: 0, cache: new Map() };
  const pointById = new Map(data.points.map((point) => [point.id, point]));

  for (const run of [...data.runs].sort((a, b) => b.checkDate.localeCompare(a.checkDate))) {
    const runEntries = data.entries.filter((entry) => entry.runId === run.id);
    if (runEntries.length === 0) continue;
    newPage(writer);
    eyebrow(writer, "Evidence");
    text(writer, `Week ending ${formatDate(run.checkDate)}`, { size: 14, bold: true, gapAfter: 2 });
    text(
      writer,
      `${run.performedByName || "Not yet signed"}${run.lockedAt ? " - completed and locked" : " - in progress"}`,
      { size: 9, colour: MUTED, gapAfter: 4 },
    );

    for (const entry of runEntries) {
      const point = pointById.get(entry.pointId);
      const cellStatus = model.rows
        .find((row) => row.point.id === entry.pointId)
        ?.cells.find((cell) => cell.runId === run.id);
      const status = (cellStatus?.state ?? "not_applicable") as ComplianceStatus | "not_checked";

      ensure(writer, 120);
      rule(writer, 6, 6);
      text(
        writer,
        `${point?.location ?? "Unknown location"} - ${point?.unitRef ?? "Unknown"}${
          point?.unitType ? ` (${point.unitType})` : ""
        }`,
        { size: 11, bold: true },
      );
      text(writer, `Outcome: ${CELL_LABELS[status] ?? "Not applicable"}`, {
        size: 10,
        colour: status === "non_compliant" ? rgb(0.68, 0.11, 0.13) : INK,
        gapAfter: 2,
      });

      for (const field of fieldsForUnitType(definition, point?.unitType ?? null)) {
        const derived = derivedDueDate(field, entry.answers);
        const value = entry.answers[field.id] ?? derived ?? null;
        text(writer, `${field.label}  ${answerText(value)}`, {
          size: 9,
          colour: MUTED,
          x: MARGIN + 12,
          width: CONTENT_WIDTH - 12,
        });
      }
      if (entry.naReason) {
        text(writer, `Not applicable: ${entry.naReason}`, { size: 9, colour: MUTED, x: MARGIN + 12 });
      }
      if (entry.note) {
        text(writer, `Note: ${entry.note}`, { size: 9, x: MARGIN + 12, width: CONTENT_WIDTH - 12 });
      }

      if (entry.photoId) {
        const image = await embed(writer, fetcher, entry.photoId, data.photoUrls.get(entry.photoId));
        if (image) {
          drawImage(writer, image, CONTENT_WIDTH * 0.62, 240);
          const captured = data.photoCaptured.get(entry.photoId);
          if (captured) {
            text(writer, `Photographed ${formatDate(captured)}`, { size: 8, colour: MUTED });
          }
        } else {
          text(writer, "Photograph could not be read from storage.", { size: 9, colour: MUTED });
        }
      } else if (
        photoMissing(input.checkType, (status === "not_checked" ? "not_applicable" : status), entry)
      ) {
        text(writer, "PHOTOGRAPH MISSING - this point has no evidence for this week.", {
          size: 9,
          bold: true,
          colour: rgb(0.68, 0.11, 0.13),
        });
      }
    }
  }

  /* Actions schedule ------------------------------------------------ */
  newPage(writer);
  eyebrow(writer, "Actions");
  text(writer, "Raised, owned and closed out", { size: 14, bold: true, gapAfter: 6 });

  const runIds = new Set(data.runs.map((run) => run.id));
  const relevant = data.actions.filter(
    (action) =>
      action.status !== "closed" || (action.raisedRunId && runIds.has(action.raisedRunId)),
  );

  if (relevant.length === 0) {
    text(writer, "No actions are open, and none were raised in this period.", {
      size: 10,
      colour: MUTED,
    });
  } else {
    for (const action of relevant) {
      ensure(writer, 46);
      const point = action.pointId ? pointById.get(action.pointId) : undefined;
      text(writer, action.description, { size: 10, bold: true });
      text(
        writer,
        [
          point ? `${point.location} - ${point.unitRef}` : "Site-wide",
          `Owner: ${action.owner || "unassigned"}`,
          `Opened ${formatDate(action.openedOn)}`,
          action.targetDate ? `Target ${formatDate(action.targetDate)}` : "",
          action.status === "closed"
            ? `Closed ${formatDate(action.closedOn)}`
            : action.status === "in_progress"
              ? "In progress"
              : "Open",
          isActionOverdue(action) ? "OVERDUE" : "",
        ]
          .filter(Boolean)
          .join("  -  "),
        { size: 9, colour: isActionOverdue(action) ? rgb(0.68, 0.11, 0.13) : MUTED },
      );
      if (action.closeoutNote) {
        text(writer, `Close-out: ${action.closeoutNote}`, { size: 9, colour: MUTED });
      }
      if (action.closeoutPhotoId) {
        const image = await embed(
          writer,
          fetcher,
          action.closeoutPhotoId,
          data.photoUrls.get(action.closeoutPhotoId),
        );
        if (image) drawImage(writer, image, CONTENT_WIDTH * 0.5, 200);
      }
      rule(writer, 4, 6);
    }
  }

  /* Footers ---------------------------------------------------------- */
  const pages = doc.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawText(sanitise(writer.footer).slice(0, 92), {
      x: MARGIN,
      y: MARGIN - 18,
      size: 8,
      font: regular,
      color: MUTED,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    sheet.drawText(label, {
      x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 18,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return {
    bytes: await doc.save(),
    filename: packFilename({
      checkTypeLabel: definition.label,
      projectName,
      weekEnding,
      single: input.single,
    }),
  };
}
