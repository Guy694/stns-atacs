/**
 * ส่วนที่ไม่แตะฐานข้อมูลของ "ประกาศ / ประชาสัมพันธ์แบบ popup"
 * (แยกไว้เพื่อให้ทดสอบได้ และใช้ร่วมกับ client component ได้)
 */
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_VERSION_MAX = 20;
/** setting_value เป็น varchar(255) จึงแบ่งข้อความเก็บเป็นหลายชิ้น */
export const ANNOUNCEMENT_CHUNK_SIZE = 250;
export const ANNOUNCEMENT_CHUNK_COUNT = 4;
export const ANNOUNCEMENT_MESSAGE_MAX = ANNOUNCEMENT_CHUNK_SIZE * ANNOUNCEMENT_CHUNK_COUNT;
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type AnnouncementState = {
  enabled: boolean;
  title: string;
  /** เลขเวอร์ชันที่ประกาศ เช่น 1.0.0 (ไม่บังคับ) */
  version: string;
  message: string;
  /** ชื่อไฟล์ภาพที่อัปโหลด (ว่าง = ไม่มีภาพ) */
  imageName: string;
  /** เปลี่ยนทุกครั้งที่บันทึก เพื่อให้ผู้ใช้ที่เคยกดปิดแล้วเห็นประกาศฉบับใหม่ */
  revision: string;
  updatedAt: string;
  updatedBy: string;
};

export function splitAnnouncementMessage(message: string): string[] {
  const text = message.trim().slice(0, ANNOUNCEMENT_MESSAGE_MAX);
  const chunks: string[] = [];
  for (let index = 0; index < ANNOUNCEMENT_CHUNK_COUNT; index += 1) {
    chunks.push(text.slice(index * ANNOUNCEMENT_CHUNK_SIZE, (index + 1) * ANNOUNCEMENT_CHUNK_SIZE));
  }
  return chunks;
}

export function joinAnnouncementMessage(chunks: Array<string | undefined>): string {
  return chunks.map((chunk) => chunk ?? "").join("");
}

/** popup แสดงได้เมื่อเปิดใช้งาน และมีอย่างน้อยหัวข้อ ข้อความ หรือภาพ */
export function isAnnouncementVisible(state: AnnouncementState) {
  return state.enabled && Boolean(state.title || state.message || state.imageName);
}

/** ตรวจชนิดภาพจาก byte แรก ๆ ไม่เชื่อ Content-Type ที่ผู้ใช้ส่งมา */
export function detectImageExtension(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  return null;
}

export const ANNOUNCEMENT_IMAGE_URL_PREFIX = "/uploads/announcements/";
