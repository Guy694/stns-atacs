/**
 * A4 sticker sheets for asset QR labels (printed from the browser → "Save as PDF" or straight to a printer).
 * Label sizes follow common A4 label stock so the print lines up with pre-cut sheets; "mini" is a
 * small grid with cut guides for plain A4 sticker paper (phones, adapters, small devices).
 * All sizes in millimetres.
 */
export type StickerLayout = "row" | "stack";

export type StickerPreset = {
  key: string;
  label: string;
  hint: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
  /** QR side length. */
  qrMm: number;
  layout: StickerLayout;
  /** Base text size in pt. */
  fontPt: number;
  /** Lines of the asset name (0 = not shown). */
  nameLines: number;
  /** Draw cut guides (plain sticker paper without pre-cut labels). */
  cutGuides: boolean;
};

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

export const STICKER_PRESETS: StickerPreset[] = [
  {
    key: "mini", label: "จิ๋ว 30 × 15 มม. (108 ดวง/แผ่น)", hint: "โทรศัพท์ อะแดปเตอร์ อุปกรณ์ขนาดเล็ก · กระดาษสติ๊กเกอร์ A4 แบบเต็มแผ่น ตัดตามเส้น",
    widthMm: 30, heightMm: 15, columns: 6, rows: 18, marginTopMm: 13.5, marginLeftMm: 15, gapXMm: 0, gapYMm: 0,
    qrMm: 13, layout: "row", fontPt: 5, nameLines: 0, cutGuides: true,
  },
  {
    key: "s65", label: "เล็ก 38.1 × 21.2 มม. (65 ดวง/แผ่น)", hint: "เมาส์ คีย์บอร์ด เราเตอร์ แท็บเล็ต · ขนาดเดียวกับสติ๊กเกอร์ A4 65 ดวง",
    widthMm: 38.1, heightMm: 21.2, columns: 5, rows: 13, marginTopMm: 10.7, marginLeftMm: 4.7, gapXMm: 2.5, gapYMm: 0,
    qrMm: 17, layout: "row", fontPt: 5.5, nameLines: 1, cutGuides: false,
  },
  {
    key: "s40", label: "กลาง 45.7 × 25.4 มม. (40 ดวง/แผ่น)", hint: "คอมพิวเตอร์ จอภาพ เครื่องพิมพ์ · ขนาดเดียวกับสติ๊กเกอร์ A4 40 ดวง",
    widthMm: 45.7, heightMm: 25.4, columns: 4, rows: 10, marginTopMm: 21.5, marginLeftMm: 9.7, gapXMm: 2.5, gapYMm: 0,
    qrMm: 21, layout: "row", fontPt: 6, nameLines: 2, cutGuides: false,
  },
  {
    key: "s21", label: "ใหญ่ 63.5 × 38.1 มม. (21 ดวง/แผ่น)", hint: "ครุภัณฑ์ขนาดใหญ่ ตู้ โต๊ะ เครื่องมือแพทย์ · ขนาดเดียวกับสติ๊กเกอร์ A4 21 ดวง",
    widthMm: 63.5, heightMm: 38.1, columns: 3, rows: 7, marginTopMm: 15.1, marginLeftMm: 7.2, gapXMm: 2.5, gapYMm: 0,
    qrMm: 30, layout: "row", fontPt: 7.5, nameLines: 3, cutGuides: false,
  },
];

export const DEFAULT_STICKER_PRESET = "s65";
export const MAX_STICKERS = 1500;

export function stickerPreset(key: string | null | undefined) {
  return STICKER_PRESETS.find((preset) => preset.key === key) ?? STICKER_PRESETS.find((preset) => preset.key === DEFAULT_STICKER_PRESET)!;
}

export function perSheet(preset: StickerPreset) {
  return preset.columns * preset.rows;
}

/** Sheet width/height actually used by the grid (must fit on A4). */
export function gridExtent(preset: StickerPreset) {
  return {
    width: preset.marginLeftMm * 2 + preset.columns * preset.widthMm + (preset.columns - 1) * preset.gapXMm,
    height: preset.marginTopMm * 2 + preset.rows * preset.heightMm + (preset.rows - 1) * preset.gapYMm,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function clampMm(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(10, Math.max(-10, Math.round(parsed * 10) / 10)) : 0;
}

export type StickerOptions = { preset: StickerPreset; skip: number; copies: number; offsetXMm: number; offsetYMm: number; outline: boolean };

/** Reads print options from the query string: preset, skip (used labels on the first sheet), copies, printer offsets. */
export function readStickerOptions(params: Record<string, string | string[] | undefined>): StickerOptions {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const preset = stickerPreset(one("size"));
  return {
    preset,
    skip: clampInt(one("skip"), 0, perSheet(preset) - 1, 0),
    copies: clampInt(one("copies"), 1, 5, 1),
    offsetXMm: clampMm(one("dx")),
    offsetYMm: clampMm(one("dy")),
    outline: one("outline") === "1",
  };
}

/** Asset ids from "ids=1,2,3" (deduplicated, order kept, capped). */
export function parseIdList(raw: string | string[] | undefined, limit = MAX_STICKERS) {
  const text = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const seen = new Set<number>();
  for (const part of text.split(/[,\s]+/)) {
    const id = Number(part);
    if (Number.isSafeInteger(id) && id > 0) seen.add(id);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/**
 * Lays labels out on sheets: `skip` empty cells first (a partly used sheet), each item repeated `copies` times.
 * Returns pages of cells (null = leave empty).
 */
export function paginateStickers<T>(items: T[], preset: StickerPreset, skip = 0, copies = 1): Array<Array<T | null>> {
  const cells: Array<T | null> = Array.from({ length: skip }, () => null);
  for (const item of items) for (let copy = 0; copy < copies; copy += 1) cells.push(item);
  const size = perSheet(preset);
  const pages: Array<Array<T | null>> = [];
  for (let start = 0; start < cells.length; start += size) {
    const page = cells.slice(start, start + size);
    while (page.length < size) page.push(null);
    pages.push(page);
  }
  return items.length ? pages : [];
}

/** Position of cell `index` on the sheet (top-left corner, mm). */
export function cellPosition(preset: StickerPreset, index: number, offsetXMm = 0, offsetYMm = 0) {
  const column = index % preset.columns;
  const row = Math.floor(index / preset.columns);
  return {
    left: Math.round((preset.marginLeftMm + column * (preset.widthMm + preset.gapXMm) + offsetXMm) * 100) / 100,
    top: Math.round((preset.marginTopMm + row * (preset.heightMm + preset.gapYMm) + offsetYMm) * 100) / 100,
  };
}

/**
 * Short QR payload: fewer modules, so the code stays readable when printed small.
 * `compact` (tiny labels) upper-cases the URL so the QR uses alphanumeric mode (one version smaller,
 * bigger modules). Scheme and host are case-insensitive; "/Q/" is rewritten to "/q/" in next.config.ts.
 */
export function stickerQrUrl(origin: string, assetId: number, compact = false) {
  const url = `${origin.replace(/\/+$/, "")}/q/${assetId}`;
  return compact ? url.toUpperCase() : url;
}
