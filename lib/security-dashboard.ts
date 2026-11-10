/**
 * Labels and aggregation for the admin security dashboard (/admin/security).
 * Pure functions only — the SQL lives in lib/security-dashboard-data.ts.
 */
export type SecurityEventGroup = "login" | "external-login" | "account" | "agent" | "access" | "system" | "other";
export type SecurityTone = "success" | "info" | "warning" | "danger";

export type SecurityEventInfo = {
  type: string;
  label: string;
  group: SecurityEventGroup;
  tone: SecurityTone;
  /** Counts toward "เหตุการณ์น่าสงสัย" and the suspicious-IP ranking. */
  suspicious: boolean;
};

export const SECURITY_EVENT_GROUPS: readonly { key: SecurityEventGroup; label: string }[] = [
  { key: "login", label: "เข้าสู่ระบบ" },
  { key: "external-login", label: "ThaiD / Google" },
  { key: "account", label: "บัญชี / ลงทะเบียน" },
  { key: "agent", label: "ATACS Agent" },
  { key: "access", label: "สิทธิ์การเข้าถึง" },
  { key: "system", label: "ระบบ" },
  { key: "other", label: "อื่น ๆ" },
];

type Def = [label: string, group: SecurityEventGroup, tone: SecurityTone, suspicious: boolean];

const EVENTS: Record<string, Def> = {
  login_succeeded: ["เข้าสู่ระบบสำเร็จ", "login", "success", false],
  login_failed_password: ["รหัสผ่านไม่ถูกต้อง", "login", "warning", true],
  login_locked_out: ["ถูกล็อกชั่วคราว (ผิดหลายครั้ง)", "login", "danger", true],
  login_invalid_input: ["ข้อมูลเข้าสู่ระบบไม่ถูกรูปแบบ", "login", "warning", true],
  login_blocked_maintenance: ["เข้าระหว่างปิดปรับปรุง", "login", "info", false],
  login_pending_account: ["บัญชีรออนุมัติพยายามเข้า", "account", "info", false],
  officer_registration_invalid: ["ลงทะเบียนข้อมูลไม่ถูกต้อง", "account", "warning", true],
  officer_registration_failed: ["ลงทะเบียนไม่สำเร็จ", "account", "info", false],
  thaid_login_failed: ["ThaiD เข้าสู่ระบบไม่สำเร็จ", "external-login", "warning", true],
  thaid_oauth_error: ["ThaiD ตอบกลับข้อผิดพลาด", "external-login", "warning", false],
  thaid_oauth_state_mismatch: ["ThaiD state ไม่ตรง (อาจถูกปลอมคำขอ)", "external-login", "warning", true],
  google_login_failed: ["Google เข้าสู่ระบบไม่สำเร็จ", "external-login", "warning", true],
  google_oauth_error: ["Google ตอบกลับข้อผิดพลาด", "external-login", "warning", false],
  google_oauth_state_mismatch: ["Google state ไม่ตรง (อาจถูกปลอมคำขอ)", "external-login", "warning", true],
  google_link_pending: ["บัญชี Google รอผูก", "external-login", "info", false],
  agent_invalid_credentials: ["Agent ใช้กุญแจไม่ถูกต้อง", "agent", "warning", true],
  agent_missing_credentials: ["Agent ไม่ส่งกุญแจ", "agent", "warning", true],
  agent_invalid_install_key: ["รหัสติดตั้ง Agent ไม่ถูกต้อง", "agent", "danger", true],
  agent_invalid_enrollment_token: ["Token ลงทะเบียน Agent ไม่ถูกต้อง", "agent", "danger", true],
  agent_enroll_rate_limited: ["ลงทะเบียน Agent ถี่เกินไป", "agent", "danger", true],
  agent_reenroll_blocked: ["กันการยึดเครื่องที่ลงทะเบียนแล้ว", "agent", "danger", true],
  agent_linked_asset_invalid: ["Agent อ้างครุภัณฑ์ที่ไม่ถูกต้อง", "agent", "warning", true],
  agent_reenrolled: ["Agent ลงทะเบียนเครื่องเดิมใหม่", "agent", "info", false],
  agent_retired: ["ปลดเครื่องออกจากระบบ", "agent", "info", false],
  agent_retired_report: ["เครื่องที่ปลดแล้วยังส่งข้อมูล", "agent", "info", false],
  agent_uninstall_requested: ["สั่งถอนการติดตั้ง Agent", "agent", "info", false],
  agent_uninstalled: ["Agent ถอนการติดตั้งแล้ว", "agent", "info", false],
  api_unauthorized: ["เรียก API โดยไม่เข้าสู่ระบบ", "access", "warning", true],
  api_forbidden: ["เรียก API เกินสิทธิ์", "access", "danger", true],
  cron_unauthorized: ["เรียกงานตั้งเวลาโดยไม่มีรหัส", "system", "danger", true],
};

export function describeSecurityEvent(type: string): SecurityEventInfo {
  const def = EVENTS[type];
  if (!def) return { type, label: type, group: "other", tone: "info", suspicious: false };
  const [label, group, tone, suspicious] = def;
  return { type, label, group, tone, suspicious };
}

export function eventTypesForGroup(group: string): string[] {
  return Object.entries(EVENTS)
    .filter(([, def]) => def[1] === group)
    .map(([type]) => type);
}

export const SUSPICIOUS_EVENT_TYPES = Object.entries(EVENTS)
  .filter(([, def]) => def[3])
  .map(([type]) => type);

export type DailyCountRow = { day: string; eventType: string; total: number };
export type DailyPoint = { day: string; success: number; failed: number; suspicious: number; other: number };

function shiftDay(isoDay: string, delta: number) {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** One point per day for the last `days` days ending `today` (YYYY-MM-DD, Bangkok), oldest first. */
export function buildDailySeries(rows: readonly DailyCountRow[], { days, today }: { days: number; today: string }): DailyPoint[] {
  const points = new Map<string, DailyPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = shiftDay(today, -offset);
    points.set(day, { day, success: 0, failed: 0, suspicious: 0, other: 0 });
  }
  for (const row of rows) {
    const point = points.get(row.day);
    if (!point) continue;
    const total = Number(row.total) || 0;
    if (row.eventType === "login_succeeded") point.success += total;
    else if (row.eventType === "login_failed_password" || row.eventType === "login_locked_out") point.failed += total;
    else if (describeSecurityEvent(row.eventType).suspicious) point.suspicious += total;
    else point.other += total;
  }
  return [...points.values()];
}

export type TypeCountRow = { eventType: string; total: number; ips?: number };
export type SecurityKpis = { loginSuccess: number; loginFailed: number; lockouts: number; suspicious: number; total: number };

export function summarizeSecurityKpis(rows: readonly TypeCountRow[]): SecurityKpis {
  const kpi: SecurityKpis = { loginSuccess: 0, loginFailed: 0, lockouts: 0, suspicious: 0, total: 0 };
  for (const row of rows) {
    const total = Number(row.total) || 0;
    kpi.total += total;
    if (row.eventType === "login_succeeded") kpi.loginSuccess += total;
    if (row.eventType === "login_failed_password") kpi.loginFailed += total;
    if (row.eventType === "login_locked_out") kpi.lockouts += total;
    if (describeSecurityEvent(row.eventType).suspicious) kpi.suspicious += total;
  }
  return kpi;
}
