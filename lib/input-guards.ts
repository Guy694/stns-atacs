// Pure validation helpers for untrusted request input (no I/O, safe to unit test).

const DEFAULT_NEXT_PATH = "/dashboard";
// Control characters, any Unicode whitespace and backslashes: browsers strip or reinterpret these
// ("/\t/evil.com" becomes "//evil.com"), so a next path containing one is never trusted.
const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f-\u009f\s\\\u2028\u2029\ufeff]/u;

/**
 * B5: the only accepted post-login destination is a same-origin absolute path.
 * Returns the normalised path (pathname + search + hash) or `fallback`.
 */
export function safeNextPath(value: unknown, fallback = DEFAULT_NEXT_PATH): string {
  if (typeof value !== "string" || !value) return fallback;
  if (value.length > 2000) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (UNSAFE_PATH_CHARS.test(value)) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(value, "http://x");
  } catch {
    return fallback;
  }
  if (resolved.origin !== "http://x") return fallback;
  if (!resolved.pathname.startsWith("/") || resolved.pathname.startsWith("//")) return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** B6: e-mail typed on the profile page. Empty = remove. Stored lower-case so look-ups match Google's. */
export function normalizeProfileEmail(value: unknown): { email: string | null; error: string | null } {
  if (value === null || value === undefined) return { email: null, error: null };
  if (typeof value !== "string") return { email: null, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  // Validate before trimming so embedded/trailing control characters are refused, not silently dropped.
  if (/[\u0000-\u001f\u007f]/u.test(value)) return { email: null, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  const email = value.trim().toLowerCase();
  if (!email) return { email: null, error: null };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { email: null, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  return { email, error: null };
}

/** MySQL unique-key violation (ER_DUP_ENTRY / 1062). */
export function isDuplicateEntryError(error: unknown) {
  const value = error as { code?: string; errno?: number } | null;
  return value?.code === "ER_DUP_ENTRY" || value?.errno === 1062;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok has no DST
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * B7: offline scans carry the client's UTC ISO time. Format it on the server as Bangkok wall-clock
 * "YYYY-MM-DD HH:mm:ss"; null when it is not a sane time (unparsable, before 2000, or > 1 day ahead).
 */
export function formatOfflineScanTime(value: unknown, now: Date = new Date()): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  if (time < Date.UTC(2000, 0, 1) || time > now.getTime() + 24 * 60 * 60 * 1000) return null;
  const local = new Date(time + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

export function offlineScanAuditNote(scannedAt: unknown, now: Date = new Date()) {
  const formatted = formatOfflineScanTime(scannedAt, now);
  return formatted ? `สแกนออฟไลน์ ${formatted}` : "สแกนออฟไลน์ (เวลาจากเครื่องไม่ถูกต้อง)";
}

export type ClientErrorReport = { message: string; name: string; where: string; digest: string; path: string | null };

/** B8: browser error report. null = reject with 400 (not an object, or a field of the wrong type). */
export function parseClientErrorBody(body: unknown): ClientErrorReport | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const optionalString = (key: string) => input[key] === undefined || typeof input[key] === "string";
  if (!["message", "name", "where", "digest"].every(optionalString)) return null;
  if (!(input.path === undefined || input.path === null || typeof input.path === "string")) return null;
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  return {
    message: text("message").slice(0, 500),
    name: (text("name") || "Error").slice(0, 100),
    where: (text("where") || "unknown").slice(0, 50),
    digest: (text("digest") || "-").slice(0, 100),
    path: typeof input.path === "string" ? input.path.slice(0, 200) : null,
  };
}
