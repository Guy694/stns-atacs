import "server-only";

import crypto from "node:crypto";

import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";

import { executeStatement, selectRows } from "@/lib/mysql";

const SESSION_COOKIE_NAME = "atacs_session";
const REGISTRATION_COOKIE_NAME = "atacs_thaid_claim";
const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? 7);

type UserRecord = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  email: string | null;
  username: string | null;
  password_hash: string | null;
  role: "admin" | "officer";
  is_active: number;
};

type SessionUserRow = RowDataPacket & {
  id: number;
  thaid_cid: string;
  full_name: string;
  email: string | null;
  role: "admin" | "officer";
};

type RegistrationClaim = {
  cid: string;
  displayName: string;
  issuedAt: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? "dev-only-atacs-secret";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isValidThaiCid(value: string) {
  return /^\d{13}$/.test(value);
}

function nowPlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function signClaimPayload(payloadBase64: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(payloadBase64).digest("hex");
}

function encodeClaim(claim: RegistrationClaim) {
  const payloadBase64 = Buffer.from(JSON.stringify(claim), "utf8").toString("base64url");
  const signature = signClaimPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function decodeClaim(value: string): RegistrationClaim | null {
  const [payloadBase64, signature] = value.split(".");

  if (!payloadBase64 || !signature) {
    return null;
  }

  if (signClaimPayload(payloadBase64) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as RegistrationClaim;

    if (!payload.cid || !isValidThaiCid(payload.cid)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function normalizeThaiCid(value: string) {
  return value.replace(/[^0-9]/g, "").trim();
}

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const separatorIndex = stored.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }
  const salt = stored.slice(0, separatorIndex);
  const hash = stored.slice(separatorIndex + 1);
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

export function validatePasswordLoginInput(username: string, password: string) {
  if (!username) {
    return "กรุณาระบุ Username";
  }
  if (password.length < 1) {
    return "กรุณาระบุรหัสผ่าน";
  }
  return null;
}

export async function findUserByThaiCid(thaiCid: string): Promise<UserRecord | null> {
  const rows = await selectRows<UserRecord>(
    `
      SELECT id, thaid_cid, full_name, email, username, password_hash, role, is_active
      FROM users
      WHERE thaid_cid = ?
      LIMIT 1
    `,
    [thaiCid]
  );

  if (!rows[0]) {
    return null;
  }

  return rows[0];
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const rows = await selectRows<UserRecord>(
    `
      SELECT id, thaid_cid, full_name, email, username, password_hash, role, is_active
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );

  return rows[0] ?? null;
}

export async function setPendingRegistrationClaim(thaiCid: string, displayName: string) {
  const cookieStore = await cookies();
  const token = encodeClaim({
    cid: thaiCid,
    displayName,
    issuedAt: Date.now(),
  });

  cookieStore.set(REGISTRATION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function getPendingRegistrationClaim() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REGISTRATION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const claim = decodeClaim(token);
  if (!claim) {
    return null;
  }

  const tenMinutesMs = 10 * 60 * 1000;
  if (Date.now() - claim.issuedAt > tenMinutesMs) {
    return null;
  }

  return claim;
}

export async function clearPendingRegistrationClaim() {
  const cookieStore = await cookies();
  cookieStore.delete(REGISTRATION_COOKIE_NAME);
}

export async function createUserFromThaiD(input: {
  thaiCid: string;
  fullName: string;
  email?: string;
}) {
  const result = await executeStatement(
    `
      INSERT INTO users (thaid_cid, full_name, email, role, is_active)
      VALUES (?, ?, ?, 'officer', 1)
    `,
    [input.thaiCid, input.fullName, input.email || null]
  );

  const createdRows = await selectRows<SessionUserRow>(
    `
      SELECT id, thaid_cid, full_name, email, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return createdRows[0] ?? null;
}

export async function createSession(userId: number) {
  const sessionToken = `${crypto.randomUUID()}-${crypto.randomBytes(16).toString("hex")}`;
  const sessionTokenHash = sha256(sessionToken);
  const expiresAt = nowPlusDays(SESSION_TTL_DAYS);

  await executeStatement(
    `
      INSERT INTO auth_sessions (user_id, session_token_hash, expires_at)
      VALUES (?, ?, ?)
    `,
    [userId, sessionTokenHash, expiresAt]
  );

  await executeStatement(
    `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ?
    `,
    [userId]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await executeStatement(
      `
        DELETE FROM auth_sessions
        WHERE session_token_hash = ?
      `,
      [sha256(rawToken)]
    );
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = sha256(rawToken);
  const rows = await selectRows<SessionUserRow>(
    `
      SELECT
        u.id,
        u.thaid_cid,
        u.full_name,
        u.email,
        u.role
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = ?
        AND s.expires_at > NOW()
        AND u.is_active = 1
      LIMIT 1
    `,
    [tokenHash]
  );

  if (!rows[0]) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return {
    id: rows[0].id,
    thaiCid: rows[0].thaid_cid as string | null,
    fullName: rows[0].full_name,
    email: rows[0].email,
    role: rows[0].role,
  };
}

export function validateThaiDLoginInput(thaiCid: string, displayName: string) {
  if (!isValidThaiCid(thaiCid)) {
    return "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก";
  }

  if (!displayName) {
    return "กรุณาระบุชื่อ-นามสกุลจาก ThaiD";
  }

  return null;
}