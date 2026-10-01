/** Resolve the public origin when Next.js standalone is running behind Nginx. */
export function getPublicRequestOrigin(request: Request): string {
  const internalUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || internalUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : internalUrl.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

export function getPublicRequestUrl(request: Request, path: string): URL {
  return new URL(path, `${getPublicRequestOrigin(request)}/`);
}
