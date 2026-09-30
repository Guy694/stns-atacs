"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { getAnnouncement, removeAnnouncementImage, saveAnnouncement, storeAnnouncementImage } from "@/lib/announcement";
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_VERSION_MAX,
  detectImageExtension,
} from "@/lib/announcement-shared";
import { getCurrentUser } from "@/lib/auth";

const PAGE = "/admin/settings/announcement";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // popup แสดงกับผู้ใช้ทั้งระบบ จึงจำกัดไว้ที่ผู้ดูแลระบบเท่านั้น
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

function fail(message: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
}

export async function updateAnnouncementAction(formData: FormData) {
  const actor = await requireAdmin();
  const current = await getAnnouncement();

  const enabled = String(formData.get("enabled") ?? "") === "true";
  const title = String(formData.get("title") ?? "").trim().slice(0, ANNOUNCEMENT_TITLE_MAX);
  const version = String(formData.get("version") ?? "").trim().slice(0, ANNOUNCEMENT_VERSION_MAX);
  const message = String(formData.get("message") ?? "").replace(/\r\n/g, "\n").trim().slice(0, ANNOUNCEMENT_MESSAGE_MAX);
  const removeImage = String(formData.get("removeImage") ?? "") === "on";

  let imageName = removeImage ? "" : current.imageName;
  let newImageName = "";
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) fail("ไฟล์ภาพต้องมีขนาดไม่เกิน 2 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = detectImageExtension(bytes);
    if (!extension) fail("รองรับเฉพาะไฟล์ภาพ JPG, PNG หรือ WebP");
    newImageName = await storeAnnouncementImage(bytes, extension);
    imageName = newImageName;
  }

  if (enabled && !title && !message && !imageName) {
    if (newImageName) await removeAnnouncementImage(newImageName);
    fail("กรุณากรอกหัวข้อ ข้อความ หรือแนบภาพอย่างน้อยหนึ่งอย่างก่อนเปิดใช้งาน");
  }

  await saveAnnouncement({ enabled, title, version, message, imageName, actorName: actor.fullName });

  // ลบไฟล์ภาพเก่าเมื่อถูกแทนที่หรือถูกลบ
  if (current.imageName && current.imageName !== imageName) await removeAnnouncementImage(current.imageName);

  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "app_settings",
    summary: enabled
      ? `เปิดประกาศ popup "${title || "(ไม่มีหัวข้อ)"}"${version ? ` เวอร์ชัน ${version}` : ""}`
      : "ปิดประกาศ popup",
  });

  revalidatePath("/", "layout");
  revalidatePath(PAGE);
  const notice = enabled
    ? "บันทึกแล้ว ผู้ใช้จะเห็นประกาศนี้หลังเข้าสู่ระบบ (ผู้ที่เคยกดไม่แสดงอีกจะเห็นฉบับใหม่นี้อีกครั้ง)"
    : "บันทึกแล้ว ปิดการแสดงประกาศ popup";
  redirect(`${PAGE}?notice=${encodeURIComponent(notice)}`);
}
