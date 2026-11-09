/**
 * Fingerprint takeover protection for /api/agent/enroll.
 *
 * A fingerprint is a SHA-256 of hardware IDs, not a secret: anyone holding the facility's install
 * command could re-enrol another machine's fingerprint and get a fresh key for that device (the real
 * agent is locked out and the attacker writes its inventory). Agents re-use their saved key on
 * reinstall, so re-enrolment is only legitimate when the device is no longer in service.
 */
export const REENROLL_QUIET_DAYS = 7;

export type ReenrollDecision = "new" | "reenroll" | "blocked";

export type ExistingAgentDevice = {
  isActive: boolean;
  uninstallRequestedAt?: string | Date | null;
  uninstalledAt: string | Date | null;
  lastSeenAt: string | Date | null;
  lastReportedAt: string | Date | null;
};

function timeOf(value: string | Date | null | undefined) {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

export function decideReenroll(existing: ExistingAgentDevice | null, nowMs: number, quietDays = REENROLL_QUIET_DAYS): ReenrollDecision {
  if (!existing) return "new";
  // Retired by an admin ("ลบออกจากระบบ"), uninstall ordered, or confirmed uninstalled: reinstalling is expected.
  if (!existing.isActive || existing.uninstallRequestedAt || existing.uninstalledAt) return "reenroll";
  const times = [timeOf(existing.lastSeenAt), timeOf(existing.lastReportedAt)].filter(Number.isFinite);
  if (times.length === 0) return "reenroll";
  const last = Math.max(...times);
  // Still reporting: only its own key may speak for it.
  return nowMs - last < quietDays * 86_400_000 ? "blocked" : "reenroll";
}
