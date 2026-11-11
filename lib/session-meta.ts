import { describeUserAgent } from "./visitor-log";

/** How a session was started (auth_sessions.login_method). */
export const LOGIN_METHODS = ["password", "thaid", "google"] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

const LABELS: Record<LoginMethod, string> = { password: "Username/Password", thaid: "ThaiD", google: "Google" };

export function loginMethodLabel(method: string | null | undefined) {
  if (!method) return "ไม่ทราบ (ก่อนเริ่มบันทึก)";
  return LABELS[method as LoginMethod] ?? method;
}

/** Same idea as the visitor log: used within 5 minutes = in use now. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const bkk = (value: string) => Date.parse(`${value.replace(" ", "T")}+07:00`);

export function sessionStatus({ lastSeenAt, expiresAt }: { lastSeenAt: string | null; expiresAt: string }, now = Date.now()): "active" | "idle" | "expired" {
  if (bkk(expiresAt) <= now) return "expired";
  if (lastSeenAt && now - bkk(lastSeenAt) <= ACTIVE_WINDOW_MS) return "active";
  return "idle";
}

const DEVICE: Record<string, string> = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์", other: "อุปกรณ์อื่น" };

function osOf(ua: string) {
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return null;
}

export function sessionDeviceLabel(userAgent: string | null | undefined) {
  if (!userAgent) return "ไม่ทราบอุปกรณ์";
  const { device, browser } = describeUserAgent(userAgent);
  return [DEVICE[device] ?? device, osOf(userAgent), browser].filter(Boolean).join(" · ");
}
