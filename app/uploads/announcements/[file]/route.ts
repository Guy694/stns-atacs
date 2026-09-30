import { readFile } from "node:fs/promises";
import path from "node:path";

import { announcementImageDir } from "@/lib/announcement";
import { getCurrentUser } from "@/lib/auth";
import { assetImageContentType, safeAssetImageName } from "@/lib/upload-storage";

type RouteContext = { params: Promise<{ file: string }> };

// ภาพประกาศแสดงเฉพาะผู้ที่เข้าสู่ระบบแล้ว
export async function GET(_request: Request, { params }: RouteContext) {
  const { file } = await params;
  const name = safeAssetImageName(decodeURIComponent(file));
  if (!name) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const bytes = await readFile(path.join(announcementImageDir(), name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": assetImageContentType(name),
        "content-length": String(bytes.length),
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
