import "server-only";

import crypto from "node:crypto";

function sha256Buffer(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

function readInstallKeys() {
  return (process.env.ATACS_AGENT_INSTALL_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export function isAgentInstallKeyConfigured() {
  return readInstallKeys().length > 0;
}

export function verifyAgentInstallKey(input: string) {
  const value = input.trim();
  if (!value) return false;

  const inputHash = sha256Buffer(value);
  return readInstallKeys().some((key) => crypto.timingSafeEqual(inputHash, sha256Buffer(key)));
}
