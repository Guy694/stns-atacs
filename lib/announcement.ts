import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { listAppSettingsByPrefix, setAppSetting } from "@/lib/app-settings";
import {
  ANNOUNCEMENT_CHUNK_COUNT,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_VERSION_MAX,
  joinAnnouncementMessage,
  splitAnnouncementMessage,
  type AnnouncementState,
} from "@/lib/announcement-shared";
import { safeAssetImageName, uploadRoot } from "@/lib/upload-storage";

/**
 * ประกาศ popup หลังเข้าสู่ระบบ — เก็บใน app_settings เดียวกับการตั้งค่าอื่น จึงไม่ต้องรัน migration
 */
const PREFIX = "announcement.";
const KEY = {
  enabled: `${PREFIX}enabled`,
  title: `${PREFIX}title`,
  version: `${PREFIX}version`,
  image: `${PREFIX}image`,
  revision: `${PREFIX}revision`,
  updatedAt: `${PREFIX}updated_at`,
  updatedBy: `${PREFIX}updated_by`,
  message: (index: number) => `${PREFIX}message.${index}`,
} as const;

export function announcementImageDir() {
  return path.join(uploadRoot(), "announcements");
}

function toBoolean(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export async function getAnnouncement(): Promise<AnnouncementState> {
  const settings = await listAppSettingsByPrefix(PREFIX);
  const message = joinAnnouncementMessage(
    Array.from({ length: ANNOUNCEMENT_CHUNK_COUNT }, (_, index) => settings[KEY.message(index)]),
  );
  return {
    enabled: toBoolean(settings[KEY.enabled]),
    title: settings[KEY.title]?.trim() ?? "",
    version: settings[KEY.version]?.trim() ?? "",
    message,
    imageName: safeAssetImageName(settings[KEY.image]) ?? "",
    revision: settings[KEY.revision]?.trim() ?? "",
    updatedAt: settings[KEY.updatedAt]?.trim() ?? "",
    updatedBy: settings[KEY.updatedBy]?.trim() ?? "",
  };
}

export async function saveAnnouncement(input: {
  enabled: boolean;
  title: string;
  version: string;
  message: string;
  imageName: string;
  actorName: string;
}) {
  await setAppSetting(KEY.enabled, input.enabled ? "true" : "false");
  await setAppSetting(KEY.title, input.title.trim().slice(0, ANNOUNCEMENT_TITLE_MAX));
  await setAppSetting(KEY.version, input.version.trim().slice(0, ANNOUNCEMENT_VERSION_MAX));
  const chunks = splitAnnouncementMessage(input.message);
  for (let index = 0; index < chunks.length; index += 1) {
    await setAppSetting(KEY.message(index), chunks[index]);
  }
  await setAppSetting(KEY.image, safeAssetImageName(input.imageName) ?? "");
  await setAppSetting(KEY.revision, `${Date.now()}`);
  await setAppSetting(KEY.updatedAt, new Date().toISOString());
  await setAppSetting(KEY.updatedBy, input.actorName.trim().slice(0, 200));
}

export async function storeAnnouncementImage(bytes: Uint8Array, extension: "jpg" | "png" | "webp") {
  const dir = announcementImageDir();
  await mkdir(dir, { recursive: true });
  const name = `announcement-${randomUUID()}.${extension}`;
  await writeFile(path.join(dir, name), bytes);
  return name;
}

export async function removeAnnouncementImage(name: string) {
  const safe = safeAssetImageName(name);
  if (!safe) return;
  try {
    await unlink(path.join(announcementImageDir(), safe));
  } catch {
    // ไฟล์อาจถูกลบไปแล้ว ไม่ถือเป็นข้อผิดพลาด
  }
}
