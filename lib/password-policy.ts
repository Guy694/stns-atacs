/** The single password rule for registration, profile change and admin resets. */
export const PASSWORD_MIN_LENGTH = 10;

const COMMON = ["password", "passw0rd", "qwerty", "123456", "admin", "welcome", "letmein", "iloveyou", "abc123", "satun"];

export function passwordPolicyError(password: string, { username }: { username?: string | null } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข";
  const lower = password.toLowerCase();
  const name = (username ?? "").trim().toLowerCase();
  if (name.length >= 3 && lower.includes(name)) return "รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ในนั้น";
  if (COMMON.some((word) => lower.startsWith(word) && /^[0-9!@#._-]*$/.test(lower.slice(word.length)))) {
    return "รหัสผ่านนี้คาดเดาง่ายเกินไป กรุณาตั้งใหม่";
  }
  return null;
}
