const configuredBasePath =
  typeof process === "undefined"
    ? ""
    : process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || "";

/** Base path configured at build time, e.g. /stns-atacs. */
export const APP_BASE_PATH = configuredBasePath === "/" ? "" : configuredBasePath;

/** Prefix browser-facing absolute paths that Next.js does not prefix automatically. */
export function withBasePath(path: string): string {
  if (!APP_BASE_PATH || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) return path;
  return `${APP_BASE_PATH}${path}`;
}
