/**
 * EXIF extraction.
 *
 * Invariant: EXIF is read from the ORIGINAL bytes, before any re-encoding or
 * derivative generation. Provenance (when and where a photograph was taken)
 * is what makes a report defensible in a dispute, and once it is stripped it
 * cannot be recovered.
 *
 * If a value is absent it is stored as null. A timestamp is NEVER fabricated.
 */

export type PhotoProvenance = {
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  width: number | null;
  height: number | null;
};

export const EMPTY_PROVENANCE: PhotoProvenance = {
  capturedAt: null,
  gpsLat: null,
  gpsLng: null,
  width: null,
  height: null,
};

const TAG_IMAGE_WIDTH = 0x0100;
const TAG_IMAGE_HEIGHT = 0x0101;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TAG_PIXEL_X = 0xa002;
const TAG_PIXEL_Y = 0xa003;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

type TagValue = number | number[] | string;
type Ifd = Map<number, TagValue>;

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, little: boolean): Ifd {
  const entries: Ifd = new Map();
  const base = tiffStart + ifdOffset;
  if (base + 2 > view.byteLength) return entries;

  const count = view.getUint16(base, little);
  for (let index = 0; index < count; index += 1) {
    const entry = base + 2 + index * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const components = view.getUint32(entry + 4, little);
    const size = TYPE_SIZES[type];
    if (!size) continue;

    const byteLength = size * components;
    const valueOffset =
      byteLength <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
    if (valueOffset < 0 || valueOffset + byteLength > view.byteLength) continue;

    if (type === 2) {
      let text = "";
      for (let i = 0; i < components; i += 1) {
        const code = view.getUint8(valueOffset + i);
        if (code === 0) break;
        text += String.fromCharCode(code);
      }
      entries.set(tag, text);
      continue;
    }

    const values: number[] = [];
    for (let i = 0; i < components; i += 1) {
      const at = valueOffset + i * size;
      switch (type) {
        case 1:
        case 7:
          values.push(view.getUint8(at));
          break;
        case 3:
          values.push(view.getUint16(at, little));
          break;
        case 4:
          values.push(view.getUint32(at, little));
          break;
        case 9:
          values.push(view.getInt32(at, little));
          break;
        case 5: {
          const denominator = view.getUint32(at + 4, little);
          values.push(denominator === 0 ? 0 : view.getUint32(at, little) / denominator);
          break;
        }
        case 10: {
          const denominator = view.getInt32(at + 4, little);
          values.push(denominator === 0 ? 0 : view.getInt32(at, little) / denominator);
          break;
        }
        default:
          break;
      }
    }
    entries.set(tag, values.length === 1 ? (values[0] as number) : values);
  }
  return entries;
}

function asNumber(value: TagValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return null;
}

function asString(value: TagValue | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** "2026:03:14 09:41:22" (+ optional offset) → ISO string. Never guesses. */
export function parseExifDate(raw: string | null, offset: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const zone = offset && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : "Z";
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function degrees(value: TagValue | undefined, ref: string | null): number | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const [deg = 0, min = 0, sec = 0] = value;
  const decimal = deg + min / 60 + sec / 3600;
  if (!Number.isFinite(decimal)) return null;
  const negative = ref === "S" || ref === "W";
  return negative ? -decimal : decimal;
}

/** Dimensions from the JPEG SOF marker — used only when EXIF omits them. */
function jpegFrameSize(view: DataView): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2, false);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame && offset + 9 <= view.byteLength) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * Reads a TIFF block (the payload of a JPEG APP1 segment, or the Exif item of
 * an ISOBMFF/HEIF container) into a provenance record. ONE reader serves every
 * container — HEIC provenance must never drift from JPEG provenance.
 */
function readTiffInto(view: DataView, tiffStart: number, result: PhotoProvenance): PhotoProvenance {
  if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return result;

  const byteOrder = view.getUint16(tiffStart, false);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return result;
  const little = byteOrder === 0x4949;
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return result;

  const ifd0 = readIfd(view, tiffStart, view.getUint32(tiffStart + 4, little), little);
  const exifPointer = asNumber(ifd0.get(TAG_EXIF_IFD));
  const gpsPointer = asNumber(ifd0.get(TAG_GPS_IFD));
  const exif = exifPointer
    ? readIfd(view, tiffStart, exifPointer, little)
    : new Map<number, TagValue>();
  const gps = gpsPointer ? readIfd(view, tiffStart, gpsPointer, little) : new Map<number, TagValue>();

  result.capturedAt = parseExifDate(
    asString(exif.get(TAG_DATETIME_ORIGINAL)) ??
      asString(exif.get(TAG_DATETIME_DIGITIZED)) ??
      asString(ifd0.get(TAG_DATETIME)),
    asString(exif.get(TAG_OFFSET_TIME_ORIGINAL)),
  );

  const lat = degrees(gps.get(TAG_GPS_LAT), asString(gps.get(TAG_GPS_LAT_REF)));
  const lng = degrees(gps.get(TAG_GPS_LNG), asString(gps.get(TAG_GPS_LNG_REF)));
  if (lat !== null && Math.abs(lat) <= 90) result.gpsLat = lat;
  if (lng !== null && Math.abs(lng) <= 180) result.gpsLng = lng;

  result.width =
    asNumber(exif.get(TAG_PIXEL_X)) ?? asNumber(ifd0.get(TAG_IMAGE_WIDTH)) ?? result.width;
  result.height =
    asNumber(exif.get(TAG_PIXEL_Y)) ?? asNumber(ifd0.get(TAG_IMAGE_HEIGHT)) ?? result.height;

  return result;
}

/* ------------------------------------------------------------------ */
/* ISOBMFF (HEIC / HEIF / AVIF) container                              */
/* ------------------------------------------------------------------ */

/**
 * Brands iPhones and Android phones actually emit. Detection is by the `ftyp`
 * box brand, never by file extension — a `.jpg` from iOS may be HEIC bytes and
 * a `.heic` may already have been transcoded to JPEG by Safari.
 */
const ISOBMFF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

function fourCC(view: DataView, at: number): string {
  let text = "";
  for (let i = 0; i < 4; i += 1) text += String.fromCharCode(view.getUint8(at + i));
  return text;
}

type Box = { type: string; start: number; end: number; contentStart: number };

/** Iterates the boxes between `start` and `end`. Malformed sizes stop the walk. */
function readBoxes(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset, false);
    const type = fourCC(view, offset + 4);
    let contentStart = offset + 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const high = view.getUint32(offset + 8, false);
      const low = view.getUint32(offset + 12, false);
      size = high * 2 ** 32 + low;
      contentStart = offset + 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < 8 || offset + size > end) break;
    boxes.push({ type, start: offset, end: offset + size, contentStart });
    offset += size;
  }
  return boxes;
}

function findBox(boxes: Box[], type: string): Box | undefined {
  return boxes.find((box) => box.type === type);
}

/** The `Exif` item id from the item information box. */
function exifItemId(view: DataView, meta: Box): number | null {
  const iinf = findBox(readBoxes(view, meta.contentStart + 4, meta.end), "iinf");
  if (!iinf) return null;
  const version = view.getUint8(iinf.contentStart);
  const entriesStart = iinf.contentStart + 4 + (version === 0 ? 2 : 4);
  for (const infe of readBoxes(view, entriesStart, iinf.end)) {
    if (infe.type !== "infe") continue;
    const infeVersion = view.getUint8(infe.contentStart);
    if (infeVersion < 2) continue;
    const at = infe.contentStart + 4;
    const idSize = infeVersion === 2 ? 2 : 4;
    const id = idSize === 2 ? view.getUint16(at, false) : view.getUint32(at, false);
    const itemType = fourCC(view, at + idSize + 2);
    if (itemType === "Exif") return id;
  }
  return null;
}

/** The byte offset of an item's first extent, from the item location box. */
function itemOffset(view: DataView, meta: Box, wantedId: number): number | null {
  const iloc = findBox(readBoxes(view, meta.contentStart + 4, meta.end), "iloc");
  if (!iloc) return null;
  const version = view.getUint8(iloc.contentStart);
  let at = iloc.contentStart + 4;
  const sizes = view.getUint8(at);
  const offsetSize = sizes >> 4;
  const lengthSize = sizes & 0x0f;
  const baseAndIndex = view.getUint8(at + 1);
  const baseOffsetSize = baseAndIndex >> 4;
  const indexSize = version === 1 || version === 2 ? baseAndIndex & 0x0f : 0;
  at += 2;

  let count: number;
  if (version < 2) {
    count = view.getUint16(at, false);
    at += 2;
  } else {
    count = view.getUint32(at, false);
    at += 4;
  }

  const readSized = (position: number, size: number): number => {
    if (size === 0) return 0;
    if (size === 4) return view.getUint32(position, false);
    if (size === 8) {
      return view.getUint32(position, false) * 2 ** 32 + view.getUint32(position + 4, false);
    }
    if (size === 2) return view.getUint16(position, false);
    return view.getUint8(position);
  };

  for (let i = 0; i < count; i += 1) {
    if (at + 8 > iloc.end) return null;
    const id = version < 2 ? view.getUint16(at, false) : view.getUint32(at, false);
    at += version < 2 ? 2 : 4;
    if (version === 1 || version === 2) at += 2; // construction_method
    at += 2; // data_reference_index
    const baseOffset = readSized(at, baseOffsetSize);
    at += baseOffsetSize;
    const extentCount = view.getUint16(at, false);
    at += 2;
    for (let extent = 0; extent < extentCount; extent += 1) {
      at += indexSize;
      const extentOffset = readSized(at, offsetSize);
      at += offsetSize;
      at += lengthSize;
      if (id === wantedId && extent === 0) return baseOffset + extentOffset;
    }
  }
  return null;
}

/** Largest `ispe` in the container — the primary image, not a thumbnail item. */
function ispeSize(view: DataView, meta: Box): { width: number; height: number } | null {
  const iprp = findBox(readBoxes(view, meta.contentStart + 4, meta.end), "iprp");
  if (!iprp) return null;
  const ipco = findBox(readBoxes(view, iprp.contentStart, iprp.end), "ipco");
  if (!ipco) return null;
  let best: { width: number; height: number } | null = null;
  for (const box of readBoxes(view, ipco.contentStart, ipco.end)) {
    if (box.type !== "ispe" || box.contentStart + 12 > box.end) continue;
    const width = view.getUint32(box.contentStart + 4, false);
    const height = view.getUint32(box.contentStart + 8, false);
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best;
}

function isobmffBrand(view: DataView): string | null {
  if (view.byteLength < 16) return null;
  if (fourCC(view, 4) !== "ftyp") return null;
  const major = fourCC(view, 8);
  if (ISOBMFF_BRANDS.has(major)) return major;
  // Compatible brands list.
  const size = view.getUint32(0, false);
  for (let at = 16; at + 4 <= Math.min(size, view.byteLength); at += 4) {
    const brand = fourCC(view, at);
    if (ISOBMFF_BRANDS.has(brand)) return brand;
  }
  return null;
}

/** True when these bytes are a HEIC/HEIF/AVIF container, judged by the bytes. */
export function isIsobmffImage(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 16) return false;
  return isobmffBrand(new DataView(bytes)) !== null;
}

export function isJpegImage(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  return new DataView(bytes).getUint16(0, false) === 0xffd8;
}

function readIsobmffProvenance(view: DataView): PhotoProvenance {
  const result: PhotoProvenance = { ...EMPTY_PROVENANCE };
  const meta = findBox(readBoxes(view, 0, view.byteLength), "meta");
  if (!meta) return result;

  const size = ispeSize(view, meta);
  if (size) {
    result.width = size.width;
    result.height = size.height;
  }

  const id = exifItemId(view, meta);
  if (id === null) return result;
  const offset = itemOffset(view, meta, id);
  if (offset === null || offset + 8 > view.byteLength) return result;

  // The Exif item payload begins with a 4-byte offset to the "Exif\0\0"
  // header, then the TIFF block the shared reader already understands.
  const skip = view.getUint32(offset, false);
  let tiffStart = offset + 4 + skip;
  if (tiffStart + 6 <= view.byteLength && fourCC(view, tiffStart) === "Exif") tiffStart += 6;
  return readTiffInto(view, tiffStart, result);
}

/**
 * Read provenance straight from the uploaded bytes. Pure — no canvas, no
 * re-encoding, no network. Anything unreadable yields null, never a default.
 * Handles JPEG and ISOBMFF (HEIC / HEIF / AVIF) containers through the same
 * TIFF reader.
 */
export function readProvenance(bytes: ArrayBuffer): PhotoProvenance {
  const view = new DataView(bytes);
  if (view.byteLength < 4) return { ...EMPTY_PROVENANCE };

  if (view.getUint16(0, false) !== 0xffd8) {
    if (isobmffBrand(view)) {
      try {
        return readIsobmffProvenance(view);
      } catch {
        // An unparseable container yields nulls. Never a fabricated value.
        return { ...EMPTY_PROVENANCE };
      }
    }
    return { ...EMPTY_PROVENANCE };
  }

  const frame = jpegFrameSize(view);
  const result: PhotoProvenance = {
    ...EMPTY_PROVENANCE,
    width: frame?.width ?? null,
    height: frame?.height ?? null,
  };

  // Locate the APP1 "Exif\0\0" segment.
  let offset = 2;
  let tiffStart = -1;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // start of scan — no EXIF beyond here
    const length = view.getUint16(offset + 2, false);
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      let header = "";
      for (let i = 0; i < 4; i += 1) header += String.fromCharCode(view.getUint8(offset + 4 + i));
      if (header === "Exif") {
        tiffStart = offset + 10;
        break;
      }
    }
    offset += 2 + length;
  }

  return readTiffInto(view, tiffStart, result);
}


/**
 * Browser-only fallback for formats whose header we do not parse (HEIC, PNG,
 * WebP). Decoding is read-only: the original file is never re-encoded here.
 */
export async function probeDimensions(
  file: Blob,
): Promise<{ width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/** Reads provenance from a File, falling back to a decode-only size probe. */
export async function readProvenanceFromFile(file: File): Promise<PhotoProvenance> {
  const bytes = await file.arrayBuffer();
  const provenance = readProvenance(bytes);
  if (provenance.width === null || provenance.height === null) {
    const probed = await probeDimensions(file);
    return {
      ...provenance,
      width: provenance.width ?? probed.width,
      height: provenance.height ?? probed.height,
    };
  }
  return provenance;
}
