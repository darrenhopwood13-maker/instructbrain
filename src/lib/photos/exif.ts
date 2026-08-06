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
 * Read provenance straight from the uploaded bytes. Pure — no canvas, no
 * re-encoding, no network. Anything unreadable yields null, never a default.
 */
export function readProvenance(bytes: ArrayBuffer): PhotoProvenance {
  const view = new DataView(bytes);
  if (view.byteLength < 4) return { ...EMPTY_PROVENANCE };
  if (view.getUint16(0, false) !== 0xffd8) return { ...EMPTY_PROVENANCE };

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

  if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return result;

  const byteOrder = view.getUint16(tiffStart, false);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return result;
  const little = byteOrder === 0x4949;
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return result;

  const ifd0 = readIfd(view, tiffStart, view.getUint32(tiffStart + 4, little), little);
  const exifPointer = asNumber(ifd0.get(TAG_EXIF_IFD));
  const gpsPointer = asNumber(ifd0.get(TAG_GPS_IFD));
  const exif = exifPointer ? readIfd(view, tiffStart, exifPointer, little) : new Map<number, TagValue>();
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
