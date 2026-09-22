import path from "node:path";

/**
 * Uploaded asset photos live OUTSIDE public/ so they are only served through the
 * authenticated route app/uploads/assets/[file] (login + facility check).
 * - UPLOAD_DIR (Docker: /app/storage/uploads) overrides the default <project>/storage/uploads.
 * - Photos saved by older versions under public/uploads are still found (legacy fallback);
 *   move them to the new folder so they are no longer reachable without logging in.
 * The URL kept in the database stays "/uploads/assets/<file>", so existing rows keep working.
 */
export const ASSET_IMAGE_URL_PREFIX = "/uploads/assets/";

const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpg|jpeg|png|webp)$/i;

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function uploadRoot(env: Record<string, string | undefined> = process.env, cwd = process.cwd()) {
  const configured = env.UPLOAD_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(cwd, "storage", "uploads");
}

export function legacyUploadRoot(cwd = process.cwd()) {
  return path.join(cwd, "public", "uploads");
}

export function assetImageDir(env?: Record<string, string | undefined>, cwd?: string) {
  return path.join(uploadRoot(env, cwd), "assets");
}

/** Accepts only a plain file name produced by the uploader (no slashes, no "..", image extension). */
export function safeAssetImageName(name: string | null | undefined) {
  const value = String(name ?? "").trim();
  if (!SAFE_FILE.test(value) || value.includes("..")) return null;
  return value;
}

export function assetImageUrl(fileName: string) {
  return `${ASSET_IMAGE_URL_PREFIX}${fileName}`;
}

export function assetImageContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/** Where to look for a stored photo, in order: current upload folder, then the legacy public folder. */
export function assetImageCandidates(fileName: string, env?: Record<string, string | undefined>, cwd?: string) {
  const safe = safeAssetImageName(fileName);
  if (!safe) return [];
  const primary = path.join(assetImageDir(env, cwd), safe);
  const legacy = path.join(legacyUploadRoot(cwd), "assets", safe);
  return primary === legacy ? [primary] : [primary, legacy];
}
