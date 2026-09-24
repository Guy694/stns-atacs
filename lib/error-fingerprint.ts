/**
 * ย่อข้อผิดพลาดให้เป็น "ลายนิ้วมือ" เพื่อรวมข้อผิดพลาดเดียวกันเข้าด้วยกัน
 * และตัดข้อมูลที่อาจระบุตัวบุคคล/ความลับออกก่อนส่งไปช่องทางแจ้งเตือน
 */
const REDACTIONS: [RegExp, string][] = [
  [/\b\d{13}\b/g, "[เลขบัตร]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[อีเมล]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ไอพี]"],
  [/(password|passwd|secret|token|key|authorization)\s*[=:]\s*\S+/gi, "$1=[ซ่อน]"],
];

export function redactErrorText(text: string, maxLength = 500) {
  let value = text ?? "";
  for (const [pattern, replacement] of REDACTIONS) value = value.replace(pattern, replacement);
  value = value.replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

/** บรรทัดแรกของ stack ที่เป็นโค้ดของเรา ใช้ประกอบลายนิ้วมือให้แยกจุดเกิดเหตุได้ */
export function firstAppFrame(stack: string | undefined) {
  if (!stack) return "";
  const lines = stack.split("\n").slice(1);
  const frame = lines.find((line) => !/node_modules|node:internal/.test(line)) ?? lines[0] ?? "";
  return frame.trim().replace(/^at\s+/, "").slice(0, 200);
}

export function errorFingerprint(input: { name?: string; message?: string; stack?: string; where?: string }) {
  const parts = [
    input.where ?? "",
    input.name ?? "Error",
    // ตัวเลขในข้อความมักเป็น id ที่ต่างกันทุกครั้ง รวมเข้าด้วยกันเพื่อไม่ให้แจ้งซ้ำ
    redactErrorText(input.message ?? "", 160).replace(/\d+/g, "#"),
    firstAppFrame(input.stack),
  ];
  return parts.filter(Boolean).join(" | ").slice(0, 400);
}
