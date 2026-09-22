/**
 * Whether auth cookies carry the Secure flag. Defaults to true in production (HTTPS, e.g. Vercel or a TLS
 * reverse proxy). Set AUTH_COOKIE_SECURE=false only for an internal server reached over plain HTTP,
 * otherwise browsers drop the session cookie and login never sticks.
 */
export function secureCookiesEnabled() {
  const value = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") return false;
  if (value === "true" || value === "1" || value === "on") return true;
  return process.env.NODE_ENV === "production";
}
