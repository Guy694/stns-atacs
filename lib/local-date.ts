// Date helpers that keep the Bangkok calendar. Safe for both server and client code.
//
// MySQL runs with default-time-zone=+07:00 and mysql2 turns DATE/DATETIME into Date objects
// in the Node process time zone (TZ=Asia/Bangkok). `toISOString()` converts those to UTC,
// which moves a DATE back one day and a DATETIME back 7 hours — so never use it on DB values.

const pad = (value: number) => String(value).padStart(2, "0");

const bangkokDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date (YYYY-MM-DD) on the Bangkok calendar, wherever the code runs. */
export function todayBangkok(now: Date = new Date()) {
  return bangkokDayFormat.format(now);
}

/** A DB DATE/DATETIME value as YYYY-MM-DD, exactly as stored. */
export function dbDate(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}

/** A DB DATETIME value as "YYYY-MM-DD HH:mm:ss" (Bangkok wall clock), exactly as stored. */
export function dbDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${dbDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  return String(value).replace("T", " ").slice(0, 19);
}
