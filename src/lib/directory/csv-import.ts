/**
 * Directory CSV import.
 *
 * Pure parsing and validation: no row is ever silently skipped. Every row of
 * the file comes back, either as a valid entry or with the specific reasons it
 * cannot be accepted, so the person importing sees exactly what is wrong and
 * where.
 */

export const CSV_COLUMNS = ["trade", "company", "contact", "email", "phone"] as const;

export type CsvRow = {
  /** 1-based line number in the file, header included, for the error list. */
  line: number;
  trade: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
};

export type CsvRowResult =
  | { line: number; valid: true; row: CsvRow }
  | { line: number; valid: false; row: CsvRow; errors: string[] };

export type CsvParseResult = {
  /** Every data row, valid or not, in file order. */
  rows: CsvRowResult[];
  validCount: number;
  invalidCount: number;
  /** A whole-file problem — an unreadable header, or no rows at all. */
  fatal: string | null;
};

/** RFC4180-ish splitter: handles quoted fields and escaped double quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      out.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  out.push(field);
  return out.map((value) => value.trim());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9 ()+\-.]{6,24}$/;

function normaliseHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/name$/, "");
}

const HEADER_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  trade: "trade",
  company: "company",
  contractor: "company",
  subcontractor: "company",
  contact: "contact",
  person: "contact",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  telephone: "phone",
  tel: "phone",
  mobile: "phone",
};

export function parseDirectoryCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const firstIndex = lines.findIndex((line) => line.trim() !== "");
  if (firstIndex === -1) {
    return { rows: [], validCount: 0, invalidCount: 0, fatal: "That file is empty." };
  }

  const header = splitCsvLine(lines[firstIndex] ?? "").map(normaliseHeader);
  const index: Partial<Record<(typeof CSV_COLUMNS)[number], number>> = {};
  header.forEach((cell, position) => {
    const column = HEADER_ALIASES[cell.replace(/address$/, "")] ?? HEADER_ALIASES[cell];
    if (column && index[column] === undefined) index[column] = position;
  });

  const missing = (["trade", "company", "email"] as const).filter(
    (column) => index[column] === undefined,
  );
  if (missing.length > 0) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      fatal:
        `The first row must be a header naming the columns. These are missing: ${missing.join(", ")}. ` +
        `Expected: ${CSV_COLUMNS.join(", ")}.`,
    };
  }

  const rows: CsvRowResult[] = [];
  for (let position = firstIndex + 1; position < lines.length; position += 1) {
    const raw = lines[position] ?? "";
    if (raw.trim() === "") continue;
    const cells = splitCsvLine(raw);
    const at = (column: (typeof CSV_COLUMNS)[number]): string => {
      const cellIndex = index[column];
      return cellIndex === undefined ? "" : (cells[cellIndex] ?? "").trim();
    };

    const row: CsvRow = {
      line: position + 1,
      trade: at("trade"),
      company: at("company"),
      contact: at("contact"),
      email: at("email"),
      phone: at("phone"),
    };

    const errors: string[] = [];
    if (row.trade === "") errors.push("Trade is missing.");
    if (row.company === "") errors.push("Company is missing.");
    if (row.email === "") errors.push("Email address is missing.");
    else if (!EMAIL.test(row.email)) errors.push(`"${row.email}" is not an email address.`);
    if (row.phone !== "" && !PHONE.test(row.phone)) {
      errors.push(`"${row.phone}" is not a telephone number.`);
    }
    if (row.contact === "" && row.email !== "") {
      // A missing name is recoverable, not a rejection: the address is enough
      // to reach someone, and the name can be filled in afterwards.
      row.contact = row.email.split("@")[0] ?? "";
    }

    rows.push(
      errors.length === 0
        ? { line: row.line, valid: true, row }
        : { line: row.line, valid: false, row, errors },
    );
  }

  if (rows.length === 0) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      fatal: "That file has a header but no rows.",
    };
  }

  return {
    rows,
    validCount: rows.filter((row) => row.valid).length,
    invalidCount: rows.filter((row) => !row.valid).length,
    fatal: null,
  };
}

export type GroupedImport = {
  trade: string;
  company: string;
  contacts: Array<{ name: string; email: string; phone: string }>;
};

/** Valid rows collapsed into one entry per trade + company pair. */
export function groupImportRows(result: CsvParseResult): GroupedImport[] {
  const groups = new Map<string, GroupedImport>();
  for (const entry of result.rows) {
    if (!entry.valid) continue;
    const key = `${entry.row.trade.toLowerCase()}::${entry.row.company.toLowerCase()}`;
    const group = groups.get(key) ?? {
      trade: entry.row.trade,
      company: entry.row.company,
      contacts: [],
    };
    group.contacts.push({
      name: entry.row.contact,
      email: entry.row.email,
      phone: entry.row.phone,
    });
    groups.set(key, group);
  }
  return [...groups.values()];
}

export const CSV_TEMPLATE = `trade,company,contact,email,phone
Roofing,Halden Roofing Ltd,Sam Halden,sam@haldenroofing.co.uk,01234 567890
`;
