/**
 * N3: บัญชี/IP ที่ถูกล็อกชั่วคราวจากการใส่รหัสผ่านผิด (ต่อยอด lib/login-throttle.ts)
 * ไฟล์นี้ไม่แตะฐานข้อมูล ใช้ได้ทั้งหน้าเว็บและทดสอบโดยตรง
 */

/** ผู้ดูแลระบบปลดล็อกบัญชี: ตัวนับความล้มเหลวของบัญชีเริ่มใหม่หลังเหตุการณ์นี้ (เหมือนเข้าสู่ระบบสำเร็จ) */
export const LOGIN_UNLOCK_EVENT = "login_unlocked";
/** ผู้ดูแลระบบปลดล็อก IP */
export const LOGIN_IP_UNLOCK_EVENT = "login_ip_unlocked";

type Policy = { windowMinutes: number; maxPerAccount: number; maxPerIp: number };

const parse = (value: string) => Date.parse(`${value.replace(" ", "T")}+07:00`);
const pad = (n: number) => String(n).padStart(2, "0");
function format(ms: number) {
  const d = new Date(ms + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * นับแบบหน้าต่างเลื่อน: ล็อกอยู่ตราบที่ใน `windowMinutes` ล่าสุดมีความล้มเหลว >= max
 * จึงปลดล็อกเมื่อความล้มเหลวลำดับที่ (n - max) นับจากเก่าสุดหลุดออกจากหน้าต่าง · null = ไม่ถูกล็อก
 */
export function lockReleaseAt(failures: readonly string[], max: number, windowMinutes: number): string | null {
  const sorted = [...failures].sort();
  if (sorted.length < max) return null;
  return format(parse(sorted[sorted.length - max]) + windowMinutes * 60 * 1000);
}

export type AccountFailures = { identity: string; exists: boolean; displayName: string | null; failures: string[]; ips: string[] };
export type IpFailures = { ip: string; failures: string[]; identities: string[] };
export type LockedAccount = Omit<AccountFailures, "failures"> & { failures: number; releaseAt: string; minutesLeft: number };
export type LockedIp = Omit<IpFailures, "failures"> & { failures: number; releaseAt: string; minutesLeft: number };

export function summarizeLockedLogins(input: { accounts: AccountFailures[]; ips: IpFailures[] }, policy: Policy, now = Date.now()) {
  const minutesLeft = (releaseAt: string) => Math.ceil((parse(releaseAt) - now) / 60000);
  const accounts: LockedAccount[] = [];
  for (const row of input.accounts) {
    const releaseAt = lockReleaseAt(row.failures, policy.maxPerAccount, policy.windowMinutes);
    if (releaseAt && parse(releaseAt) > now) accounts.push({ ...row, failures: row.failures.length, releaseAt, minutesLeft: minutesLeft(releaseAt) });
  }
  const ips: LockedIp[] = [];
  for (const row of input.ips) {
    const releaseAt = lockReleaseAt(row.failures, policy.maxPerIp, policy.windowMinutes);
    if (releaseAt && parse(releaseAt) > now) ips.push({ ...row, failures: row.failures.length, releaseAt, minutesLeft: minutesLeft(releaseAt) });
  }
  return { accounts, ips };
}

/** หลังบันทึกความล้มเหลวครั้งนี้: เพิ่งถึงเพดานพอดีหรือไม่ (แจ้ง Telegram ครั้งเดียว ไม่ซ้ำทุกครั้งที่ลองต่อ) */
export function justReachedLock(counts: { account: number; ip: number }, policy: Policy): "account" | "ip" | null {
  if (counts.account === policy.maxPerAccount) return "account";
  if (counts.ip === policy.maxPerIp) return "ip";
  return null;
}
