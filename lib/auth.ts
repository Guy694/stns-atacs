import "server-only";

import crypto from "node:crypto";

import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";

import { executeStatement, selectRows } from "@/lib/mysql";

const SESSION_COOKIE_NAME = "atacs_session";
const REGISTRATION_COOKIE_NAME = "atacs_registration_claim";
const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_DAYS ?? 7);
const SESSION_IDLE_TIMEOUT_MINUTES = Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES ?? 15);
const THAI_CID_ENCRYPTION_PREFIX = "thcid:v1:";

type UserRecord = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  thaid_cid_hash?: string | null;
  google_sub: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  username: string | null;
  password_hash: string | null;
  role: "admin" | "officer" | "viewer";
  is_active: number;
};

type SessionUserRow = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  thaid_cid_hash?: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  role: "admin" | "officer" | "viewer";
  facility_id: number | null;
  session_expires_at: Date;
};

type ThaiDRegistrationClaim = {
  provider: "thaid";
  cid: string;
  displayName: string;
  issuedAt: number;
};

type GoogleRegistrationClaim = {
  provider: "google";
  googleSub: string;
  email: string;
  displayName: string;
  issuedAt: number;
};

export type RegistrationClaim = ThaiDRegistrationClaim | GoogleRegistrationClaim;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }
  return secret;
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

function getSessionIdleTimeoutMinutes() {
  return Number.isFinite(SESSION_IDLE_TIMEOUT_MINUTES) ? Math.max(1, Math.floor(SESSION_IDLE_TIMEOUT_MINUTES)) : 15;
}

function signClaimPayload(payloadBase64: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(payloadBase64).digest("hex");
}

function readRequiredKeyEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Ignore and fail below.
  }

  throw new Error(`${name} must be a 32-byte key in hex (64 chars) or base64`);
}

function getThaiCidEncryptionKey() {
  return readRequiredKeyEnv("THAID_CID_ENCRYPTION_KEY");
}

function getThaiCidHashKey() {
  const explicit = process.env.THAID_CID_HASH_KEY?.trim();
  if (!explicit) {
    return getThaiCidEncryptionKey();
  }
  return readRequiredKeyEnv("THAID_CID_HASH_KEY");
}

export function hashThaiCidForLookup(thaiCid: string) {
  return crypto.createHmac("sha256", getThaiCidHashKey()).update(thaiCid, "utf8").digest("hex");
}

export function encryptThaiCidForStorage(thaiCid: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getThaiCidEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(thaiCid, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${THAI_CID_ENCRYPTION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptThaiCidFromStorage(storedThaiCid: string | null | undefined) {
  if (!storedThaiCid) {
    return null;
  }

  if (/^\d{13}$/.test(storedThaiCid)) {
    return storedThaiCid;
  }

  if (!storedThaiCid.startsWith(THAI_CID_ENCRYPTION_PREFIX)) {
    return null;
  }

  const payload = storedThaiCid.slice(THAI_CID_ENCRYPTION_PREFIX.length);
  const [ivB64, tagB64, cipherB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !cipherB64) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ciphertext = Buffer.from(cipherB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getThaiCidEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return /^\d{13}$/.test(plain) ? plain : null;
  } catch {
    return null;
  }
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
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as {
      provider?: string;
      cid?: string;
      googleSub?: string;
      email?: string;
      displayName?: string;
      issuedAt?: number;
    };

    if (
      payload.provider === "thaid" &&
      payload.cid &&
      isValidThaiCid(payload.cid) &&
      payload.displayName &&
      payload.issuedAt
    ) {
      return {
        provider: "thaid",
        cid: payload.cid,
        displayName: payload.displayName,
        issuedAt: payload.issuedAt,
      };
    }

    if (payload.provider === "google" && payload.googleSub && payload.email && payload.displayName && payload.issuedAt) {
      return {
        provider: "google",
        googleSub: payload.googleSub,
        email: payload.email,
        displayName: payload.displayName,
        issuedAt: payload.issuedAt,
      };
    }

    // Support ThaiD claims issued before registration claims became provider-aware.
    if (!payload.provider && payload.cid && isValidThaiCid(payload.cid) && payload.displayName && payload.issuedAt) {
      return {
        provider: "thaid",
        cid: payload.cid,
        displayName: payload.displayName,
        issuedAt: payload.issuedAt,
      };
    }

    return null;
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

export function splitDisplayName(value: string) {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }
  const [firstName, ...lastNameParts] = normalized.split(" ");
  return { firstName, lastName: lastNameParts.join(" ") };
}

export function composeDisplayName(firstName: string, lastName: string) {
  return normalizeDisplayName(`${firstName} ${lastName}`);
}

export function getUserDisplayName(user: { first_name: string; last_name: string }) {
  return composeDisplayName(user.first_name, user.last_name);
}

function hydrateUserRecord(row: UserRecord) {
  return {
    ...row,
    thaid_cid: decryptThaiCidFromStorage(row.thaid_cid),
  };
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

export function validateOfficerRegistrationInput(input: {
  firstName: string;
  lastName: string;
  officerPosition: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  facilityId: number | null;
}) {
  if (input.firstName.length < 1) return "กรุณาระบุชื่อ";
  if (input.lastName.length < 1) return "กรุณาระบุนามสกุล";
  if (`${input.firstName} ${input.lastName}`.trim().length < 3) return "กรุณาระบุชื่อ-นามสกุลให้ครบถ้วน";
  if (input.officerPosition.length < 2 || input.officerPosition.length > 150) {
    return "กรุณาระบุตำแหน่งเจ้าหน้าที่ให้ครบถ้วน";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "กรุณาระบุอีเมลให้ถูกต้อง";
  if (!/^[a-zA-Z0-9._-]{4,50}$/.test(input.username)) {
    return "Username ต้องมี 4-50 ตัว และใช้เฉพาะ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง";
  }
  if (input.password.length < 10) return "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร";
  if (!/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password)) {
    return "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข";
  }
  if (input.password !== input.confirmPassword) return "ยืนยันรหัสผ่านไม่ตรงกัน";
  if (!input.facilityId || !Number.isInteger(input.facilityId)) return "กรุณาเลือกหน่วยงานที่สังกัด";
  return null;
}

export async function findUserByThaiCid(thaiCid: string): Promise<UserRecord | null> {
  const thaiCidHash = hashThaiCidForLookup(thaiCid);
  const rows = await selectRows<UserRecord>(
    `
      SELECT id, thaid_cid, thaid_cid_hash, NULL AS google_sub, first_name, last_name, email, username, password_hash, role, is_active
      FROM users
      WHERE thaid_cid_hash = ? OR thaid_cid = ?
      LIMIT 1
    `,
    [thaiCidHash, thaiCid]
  );

  if (!rows[0]) {
    return null;
  }

  const row = rows[0];
  const decryptedThaiCid = decryptThaiCidFromStorage(row.thaid_cid);
  const isLegacyPlaintext = row.thaid_cid === thaiCid && !row.thaid_cid?.startsWith(THAI_CID_ENCRYPTION_PREFIX);

  if (decryptedThaiCid === thaiCid && (isLegacyPlaintext || row.thaid_cid_hash !== thaiCidHash)) {
    await executeStatement(
      `UPDATE users SET thaid_cid = ?, thaid_cid_hash = ? WHERE id = ?`,
      [encryptThaiCidForStorage(thaiCid), thaiCidHash, row.id]
    );
    return { ...row, thaid_cid: thaiCid, thaid_cid_hash: thaiCidHash };
  }

  return hydrateUserRecord(row);
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const rows = await selectRows<UserRecord & RowDataPacket>(
    `SELECT id, thaid_cid, thaid_cid_hash, NULL AS google_sub, first_name, last_name, email, username, password_hash, role, is_active
     FROM users WHERE username = ? LIMIT 1`,
    [username]
  );

  return rows[0] ? hydrateUserRecord(rows[0]) : null;
}

export async function findUserByGoogleSub(googleSub: string): Promise<UserRecord | null> {
  const rows = await selectRows<UserRecord>(
    `SELECT id, thaid_cid, thaid_cid_hash, google_sub, first_name, last_name, email, username, password_hash, role, is_active
     FROM users WHERE google_sub = ? LIMIT 1`,
    [googleSub]
  );
  return rows[0] ? hydrateUserRecord(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await selectRows<UserRecord>(
    `SELECT id, thaid_cid, thaid_cid_hash, google_sub, first_name, last_name, email, username, password_hash, role, is_active
     FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
    [email]
  );
  return rows[0] ? hydrateUserRecord(rows[0]) : null;
}

async function setPendingRegistrationClaim(claim: RegistrationClaim) {
  const cookieStore = await cookies();
  const token = encodeClaim(claim);

  cookieStore.set(REGISTRATION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function setPendingThaiDRegistrationClaim(thaiCid: string, displayName: string) {
  await setPendingRegistrationClaim({
    provider: "thaid",
    cid: thaiCid,
    displayName,
    issuedAt: Date.now(),
  });
}

export async function setPendingGoogleRegistrationClaim(googleSub: string, email: string, displayName: string) {
  await setPendingRegistrationClaim({
    provider: "google",
    googleSub,
    email,
    displayName,
    issuedAt: Date.now(),
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
  firstName: string;
  lastName: string;
  officerPosition: string;
  email?: string;
  facilityId?: number | null;
}) {
  const encryptedThaiCid = encryptThaiCidForStorage(input.thaiCid);
  const thaiCidHash = hashThaiCidForLookup(input.thaiCid);
  let result;
  try {
    result = await executeStatement(
      `INSERT INTO users (thaid_cid, thaid_cid_hash, first_name, last_name, officer_position, email, role, facility_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'officer', ?, 0)`,
      [encryptedThaiCid, thaiCidHash, input.firstName, input.lastName, input.officerPosition, input.email || null, input.facilityId ?? null]
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unknown column") && msg.includes("facility_id")) {
      result = await executeStatement(
        `INSERT INTO users (thaid_cid, thaid_cid_hash, first_name, last_name, email, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'officer', 0)`,
        [encryptedThaiCid, thaiCidHash, input.firstName, input.lastName, input.email || null]
      );
    } else {
      throw error;
    }
  }

  const createdRows = await selectRows<SessionUserRow>(
    `
      SELECT id, thaid_cid, first_name, last_name, email, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return createdRows[0] ? { ...createdRows[0], thaid_cid: decryptThaiCidFromStorage(createdRows[0].thaid_cid) } : null;
}

export async function createUserFromGoogle(input: {
  googleSub: string;
  firstName: string;
  lastName: string;
  officerPosition: string;
  email: string;
  facilityId: number;
}) {
  const result = await executeStatement(
    `INSERT INTO users (google_sub, first_name, last_name, officer_position, email, role, facility_id, is_active)
     VALUES (?, ?, ?, ?, ?, 'officer', ?, 0)`,
    [input.googleSub, input.firstName, input.lastName, input.officerPosition, input.email, input.facilityId]
  );

  const createdRows = await selectRows<SessionUserRow>(
    `SELECT id, thaid_cid, first_name, last_name, email, role, facility_id
     FROM users WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return createdRows[0] ?? null;
}

export async function createOfficerFromPassword(input: {
  firstName: string;
  lastName: string;
  officerPosition: string;
  email: string;
  username: string;
  password: string;
  facilityId: number;
}) {
  const result = await executeStatement(
    `INSERT INTO users (first_name, last_name, officer_position, email, username, password_hash, role, facility_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 'officer', ?, 0)`,
    [input.firstName, input.lastName, input.officerPosition, input.email, input.username, hashPassword(input.password), input.facilityId]
  );

  return result.insertId;
}

export async function linkGoogleIdentity(userId: number, googleSub: string) {
  await executeStatement(
    `UPDATE users SET google_sub = ? WHERE id = ? AND (google_sub IS NULL OR google_sub = ?)`,
    [googleSub, userId, googleSub]
  );
}

export async function createSession(userId: number) {
  const sessionToken = `${crypto.randomUUID()}-${crypto.randomBytes(16).toString("hex")}`;
  const sessionTokenHash = sha256(sessionToken);
  const cookieExpiresAt = nowPlusDays(SESSION_TTL_DAYS);
  const idleTimeoutMinutes = getSessionIdleTimeoutMinutes();

  await executeStatement(
    `
      INSERT INTO auth_sessions (user_id, session_token_hash, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
    `,
    [userId, sessionTokenHash, idleTimeoutMinutes]
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
    expires: cookieExpiresAt,
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
  let rows: SessionUserRow[] = [];
  try {
    rows = await selectRows<SessionUserRow>(
      `
        SELECT
          u.id,
          u.thaid_cid,
          u.thaid_cid_hash,
          u.first_name,
          u.last_name,
          u.email,
          u.role,
          u.facility_id,
          s.expires_at AS session_expires_at
        FROM auth_sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.session_token_hash = ?
          AND s.expires_at > NOW()
          AND u.is_active = 1
        LIMIT 1
      `,
      [tokenHash]
    );
  } catch (error) {
    try {
      rows = await selectRows<SessionUserRow>(
        `
          SELECT
            u.id,
            u.thaid_cid,
            u.thaid_cid_hash,
            u.first_name,
            u.last_name,
            u.email,
            u.role,
            s.expires_at AS session_expires_at
          FROM auth_sessions s
          INNER JOIN users u ON u.id = s.user_id
          WHERE s.session_token_hash = ?
            AND s.expires_at > NOW()
            AND u.is_active = 1
          LIMIT 1
        `,
        [tokenHash]
      );
    } catch (fallbackError) {
      console.error("Session lookup failed", fallbackError instanceof Error ? fallbackError.message : error);
      return null;
    }
  }

  if (!rows[0]) {
    return null;
  }

  try {
    await executeStatement(
      `
        UPDATE auth_sessions
        SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
        WHERE session_token_hash = ?
      `,
      [getSessionIdleTimeoutMinutes(), tokenHash]
    );
  } catch {
    // Ignore refresh errors and continue using current session data.
  }

  return {
    id: rows[0].id,
    thaiCid: decryptThaiCidFromStorage(rows[0].thaid_cid),
    fullName: composeDisplayName(rows[0].first_name, rows[0].last_name),
    email: rows[0].email,
    role: rows[0].role,
    facilityId: rows[0].facility_id ?? null,
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
