// When the server moves (e.g. Vercel → own Docker server), set AGENT_API_BASE_URL on the OLD
// deployment: agents v1.1+ save the announced address and report there from the next round.
//
// SEC-06: ประกาศได้เฉพาะ https และเฉพาะโฮสต์ที่อยู่ใน AGENT_API_BASE_ALLOWED_HOSTS
// (คั่นด้วย , รองรับ *.domain) เพื่อไม่ให้ผู้ที่ยึดดีพลอยเก่าได้ สั่ง agent ทุกเครื่องย้ายไปเซิร์ฟเวอร์ตนเอง
// ฝั่ง agent มี allowlist ของตัวเองอีกชั้น
function hostAllowed(host: string, patterns: string[]) {
  return patterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1).toLowerCase();
      return host === pattern.slice(2).toLowerCase() || host.endsWith(suffix);
    }
    return host === pattern.toLowerCase();
  });
}

type AgentApiBaseEnv = { AGENT_API_BASE_URL?: string; AGENT_API_BASE_ALLOWED_HOSTS?: string };

export function announcedApiBaseUrl(env: AgentApiBaseEnv = process.env as AgentApiBaseEnv) {
  const value = env.AGENT_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;

  const patterns = (env.AGENT_API_BASE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return undefined;
  if (!hostAllowed(url.host.toLowerCase(), patterns)) return undefined;

  return value;
}
