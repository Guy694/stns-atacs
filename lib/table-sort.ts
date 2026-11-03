// Sorting and pagination for list tables. Pure functions: usable from server pages
// (state in the URL: ?sort=&dir=&page=) and from client components (state in useState).
// A page with two tables gives the second one a prefix ("h" → ?hsort=&hdir=&hpage=).

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };
export type SearchParamsLike = Record<string, string | string[] | undefined>;

export const DEFAULT_PAGE_SIZE = 25;

function one(params: SearchParamsLike, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** The requested sort when its key is whitelisted, otherwise the fallback. */
export function readSort(params: SearchParamsLike, allowed: readonly string[], fallback: SortState | null = null, prefix = ""): SortState | null {
  const key = one(params, `${prefix}sort`);
  if (!key || !allowed.includes(key)) return fallback;
  return { key, dir: one(params, `${prefix}dir`) === "desc" ? "desc" : "asc" };
}

/** A positive page number from the URL (default 1). */
export function readPage(params: SearchParamsLike, prefix = "") {
  const value = Number(one(params, `${prefix}page`));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function hrefWith(pathname: string, params: SearchParamsLike, changes: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key in changes) continue;
    const text = Array.isArray(value) ? value[0] : value;
    if (text) query.set(key, text);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}

/** Link for a column header: same column toggles asc/desc, a new column starts with `firstDir`. Resets the page. */
export function sortHref(pathname: string, params: SearchParamsLike, key: string, current: SortState | null, prefix = "", firstDir: SortDir = "asc") {
  const dir: SortDir = current?.key === key ? (current.dir === "asc" ? "desc" : "asc") : firstDir;
  return hrefWith(pathname, params, { [`${prefix}sort`]: key, [`${prefix}dir`]: dir, [`${prefix}page`]: null });
}

export function pageHref(pathname: string, params: SearchParamsLike, page: number, prefix = "") {
  return hrefWith(pathname, params, { [`${prefix}page`]: page > 1 ? String(page) : null });
}

function isBlank(value: unknown) {
  return value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));
}

const thaiCollator = new Intl.Collator("th", { numeric: true, sensitivity: "base" });

/** Ascending comparison: numbers numerically, everything else as Thai text with numeric parts. */
export function compareValues(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return thaiCollator.compare(String(a), String(b));
}

/** A sorted copy. Blank values always go last; ties keep their original order. */
export function sortRows<T>(rows: readonly T[], sort: SortState | null, accessors: Record<string, (row: T) => unknown>): T[] {
  const read = sort ? accessors[sort.key] : undefined;
  if (!sort || !read) return [...rows];
  const factor = sort.dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: read(row) }))
    .sort((a, b) => {
      const blankA = isBlank(a.value);
      const blankB = isBlank(b.value);
      if (blankA || blankB) return blankA === blankB ? a.index - b.index : blankA ? 1 : -1;
      return compareValues(a.value, b.value) * factor || a.index - b.index;
    })
    .map((item) => item.row);
}

export type Page<T> = { rows: T[]; page: number; totalPages: number; total: number; start: number; end: number; pageSize: number };

/** One page of rows; an out-of-range page is clamped to the last one. `start`/`end` are 1-based for display. */
export function paginate<T>(rows: readonly T[], page: number, pageSize = DEFAULT_PAGE_SIZE): Page<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const offset = (current - 1) * pageSize;
  const slice = rows.slice(offset, offset + pageSize);
  return { rows: slice, page: current, totalPages, total, start: total ? offset + 1 : 0, end: offset + slice.length, pageSize };
}

/** Page numbers to show: first, last, current ±1. A 0 marks a gap ("…"). */
export function pageWindow(current: number, totalPages: number) {
  const pages = [...new Set([1, current - 1, current, current + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const result: number[] = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) result.push(0);
    result.push(page);
  });
  return result;
}
