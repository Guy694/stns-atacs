const THAI_BUDDHIST_LOCALE = "th-TH-u-ca-buddhist";
const THAI_TIME_ZONE = "Asia/Bangkok";

function parseDateLike(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) {
    const parsed = new Date(`${text.replace(" ", "T")}+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatThaiDate(value: Date | string | null | undefined, fallback = "-") {
  const date = parseDateLike(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(THAI_BUDDHIST_LOCALE, {
    dateStyle: "medium",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function formatThaiDateTime(value: Date | string | null | undefined, fallback = "-") {
  const date = parseDateLike(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(THAI_BUDDHIST_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}
