"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  decryptThaiCidFromStorage,
  encryptThaiCidForStorage,
  getCurrentUser,
  hashPassword,
  hashThaiCidForLookup,
  normalizeThaiCid,
  splitDisplayName,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { executeStatement, selectRows } from "@/lib/mysql";
import { isMissingSchemaError } from "@/lib/schema-errors";
import type { RowDataPacket } from "mysql2/promise";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "admin") redirect("/dashboard");

  return user;
}

type UserRow = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  officer_position: string | null;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  facility_id: number | null;
  is_active: number;
  last_login_at: Date | string | null;
};

type UserRowWithoutFacility = RowDataPacket & {
  id: number;
  thaid_cid: string | null;
  full_name: string;
  officer_position: string | null;
  email: string | null;
  username: string | null;
  role: "admin" | "officer" | "viewer";
  is_active: number;
  last_login_at: Date | string | null;
};

type UserAuditRow = RowDataPacket & {
  id: number;
  full_name: string;
  role: "admin" | "officer" | "viewer";
};

async function getUserAuditRow(userId: number) {
  const rows = await selectRows<UserAuditRow>(
    "SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, role FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function listUsersAction() {
  await requireAdmin();
  try {
    const rows = await selectRows<UserRow>(
      `SELECT id, thaid_cid, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, officer_position, email, username, role, facility_id, is_active, last_login_at
       FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
    );
    return rows.map((row) => ({ ...row, thaid_cid: decryptThaiCidFromStorage(row.thaid_cid) }));
  } catch {
    const rows = await selectRows<UserRowWithoutFacility>(
      `SELECT id, thaid_cid, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, NULL AS officer_position, email, username, role, is_active, last_login_at
       FROM users ORDER BY role DESC, first_name ASC, last_name ASC`
    );
    return rows.map((row) => ({ ...row, thaid_cid: decryptThaiCidFromStorage(row.thaid_cid), facility_id: null }));
  }
}

export async function createUserAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const actor = await requireAdmin();

  const fullName = (fd.get("fullName") as string | null)?.trim() ?? "";
  const { firstName, lastName } = splitDisplayName(fullName);
  const officerPosition = (fd.get("officerPosition") as string | null)?.trim() || null;
  const email = (fd.get("email") as string | null)?.trim() || null;
  const username = (fd.get("username") as string | null)?.trim() || null;
  const password = (fd.get("password") as string | null)?.trim() || null;
  const thaidCidRaw = (fd.get("thaidCid") as string | null)?.trim() || null;
  const thaidCid = thaidCidRaw ? normalizeThaiCid(thaidCidRaw) : null;
  const encryptedThaiCid = thaidCid ? encryptThaiCidForStorage(thaidCid) : null;
  const thaidCidHash = thaidCid ? hashThaiCidForLookup(thaidCid) : null;
  const role = (fd.get("role") as string | null)?.trim() ?? "officer";
  const facilityIdRaw = (fd.get("facilityId") as string | null)?.trim() ?? "";
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  if (!fullName) return "กรุณากรอกชื่อ-นามสกุล";
  if (!firstName || !lastName) return "กรุณากรอกชื่อและนามสกุลให้ครบ";
  if (!thaidCid && !username) return "ต้องมีอย่างน้อย ThaiD หรือ username";
  if (thaidCid && thaidCid.length !== 13) return "เลข ThaiD ต้องเป็นตัวเลข 13 หลัก";
  if (username && !password) return "กรุณากรอกรหัสผ่านสำหรับ username";
  if (!["admin", "officer", "viewer"].includes(role)) return "Role ไม่ถูกต้อง";
  if (role === "officer" && (!facilityId || isNaN(facilityId))) return "กรุณาเลือกหน่วยงานสำหรับเจ้าหน้าที่";
  if (role === "officer" && !officerPosition) return "กรุณากรอกตำแหน่งเจ้าหน้าที่";

  if (username) {
    const existing = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (existing.length > 0) return "username นี้ถูกใช้งานแล้ว";
  }

  if (thaidCidHash) {
    const existingThaiCid = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE thaid_cid_hash = ? LIMIT 1",
      [thaidCidHash]
    );
    if (existingThaiCid.length > 0) return "ThaiD นี้มีในระบบแล้ว";
  }

  let passwordHash: string | null = null;
  if (username && password) {
    if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    passwordHash = hashPassword(password);
  }

  try {
    let createdUserId: number | null = null;
    try {
      await executeStatement(
        `INSERT INTO users (thaid_cid, thaid_cid_hash, first_name, last_name, officer_position, email, username, password_hash, role, facility_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          encryptedThaiCid,
          thaidCidHash,
          firstName,
          lastName,
          role === "officer" ? officerPosition : null,
          email,
          username,
          passwordHash,
          role,
          role === "officer" ? facilityId : null,
        ]
      );
      const createdRows = await selectRows<RowDataPacket & { id: number }>(
        `SELECT id FROM users WHERE (username = ? AND ? IS NOT NULL) OR (thaid_cid_hash = ? AND ? IS NOT NULL)
         ORDER BY id DESC LIMIT 1`,
        [username, username, thaidCidHash, thaidCidHash]
      );
      createdUserId = createdRows[0]?.id ?? null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Unknown column") && msg.includes("facility_id")) {
        if (role === "officer") {
          return "กรุณารัน migration users.facility_id ก่อนสร้างบัญชีเจ้าหน้าที่";
        }
        const result = await executeStatement(
          `INSERT INTO users (thaid_cid, thaid_cid_hash, first_name, last_name, email, username, password_hash, role, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [encryptedThaiCid, thaidCidHash, firstName, lastName, email, username, passwordHash, role]
        );
        createdUserId = result.insertId;
      } else {
        throw error;
      }
    }
    await writeAuditLog({
      userId: actor.id,
      userName: actor.fullName,
      action: "create",
      entity: "users",
      entityId: createdUserId,
      summary: `สร้างผู้ใช้ ${fullName} (${role})`,
    });
    revalidatePath("/admin/users");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate") && msg.includes("username")) return "username นี้ถูกใช้งานแล้ว";
    if (msg.includes("Duplicate") && msg.includes("thaid")) return "ThaiD นี้มีในระบบแล้ว";
    if (msg.includes("Duplicate") && msg.includes("email")) return "Email นี้ถูกใช้งานแล้ว";
    return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function updateUserProfileAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const actor = await requireAdmin();

  const userId = Number(fd.get("userId"));
  const fullName = (fd.get("fullName") as string | null)?.trim() ?? "";
  const { firstName, lastName } = splitDisplayName(fullName);
  const officerPosition = (fd.get("officerPosition") as string | null)?.trim() || null;
  const email = (fd.get("email") as string | null)?.trim() || null;
  const username = (fd.get("username") as string | null)?.trim() || null;
  const thaidCidRaw = (fd.get("thaidCid") as string | null)?.trim() || null;
  const thaidCid = thaidCidRaw ? normalizeThaiCid(thaidCidRaw) : null;
  const encryptedThaiCid = thaidCid ? encryptThaiCidForStorage(thaidCid) : null;
  const thaidCidHash = thaidCid ? hashThaiCidForLookup(thaidCid) : null;
  const role = (fd.get("role") as string | null)?.trim() ?? "officer";
  const facilityIdRaw = (fd.get("facilityId") as string | null)?.trim() ?? "";
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  if (!userId || Number.isNaN(userId)) return "User ID ไม่ถูกต้อง";
  if (!fullName) return "กรุณากรอกชื่อ-นามสกุล";
  if (!firstName || !lastName) return "กรุณากรอกชื่อและนามสกุลให้ครบ";
  if (!thaidCid && !username) return "ต้องมีอย่างน้อย ThaiD หรือ username";
  if (thaidCid && thaidCid.length !== 13) return "เลข ThaiD ต้องเป็นตัวเลข 13 หลัก";
  if (!["admin", "officer", "viewer"].includes(role)) return "Role ไม่ถูกต้อง";
  if (role === "officer" && (!facilityId || Number.isNaN(facilityId))) return "กรุณาเลือกหน่วยงานสำหรับเจ้าหน้าที่";
  if (role === "officer" && !officerPosition) return "กรุณากรอกตำแหน่งเจ้าหน้าที่";

  if (username) {
    const existing = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1",
      [username, userId]
    );
    if (existing.length > 0) return "username นี้ถูกใช้งานแล้ว";
  }

  if (thaidCidHash) {
    const existingThaiCid = await selectRows<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE thaid_cid_hash = ? AND id <> ? LIMIT 1",
      [thaidCidHash, userId]
    );
    if (existingThaiCid.length > 0) return "ThaiD นี้มีในระบบแล้ว";
  }

  try {
    const before = await getUserAuditRow(userId);
    try {
      await executeStatement(
        `UPDATE users
         SET first_name = ?, last_name = ?, officer_position = ?, email = ?, username = ?, thaid_cid = ?, thaid_cid_hash = ?, role = ?, facility_id = ?
         WHERE id = ?`,
        [
          firstName,
          lastName,
          role === "officer" ? officerPosition : null,
          email,
          username,
          encryptedThaiCid,
          thaidCidHash,
          role,
          role === "officer" ? facilityId : null,
          userId,
        ]
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Unknown column") && msg.includes("facility_id")) {
        if (role === "officer") return "กรุณารัน migration users.facility_id ก่อนกำหนดเจ้าหน้าที่";
        await executeStatement(
          `UPDATE users
           SET first_name = ?, last_name = ?, email = ?, username = ?, thaid_cid = ?, thaid_cid_hash = ?, role = ?
           WHERE id = ?`,
          [firstName, lastName, email, username, encryptedThaiCid, thaidCidHash, role, userId]
        );
      } else {
        throw error;
      }
    }
    const after = await getUserAuditRow(userId);
    await writeAuditLog({
      userId: actor.id,
      userName: actor.fullName,
      action: "update",
      entity: "users",
      entityId: userId,
      summary: `แก้ไขผู้ใช้ ${after?.full_name ?? before?.full_name ?? `#${userId}`} (${before?.role ?? "-"} -> ${after?.role ?? role})`,
    });
    revalidatePath("/admin/users");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate") && msg.includes("username")) return "username นี้ถูกใช้งานแล้ว";
    if (msg.includes("Duplicate") && msg.includes("thaid")) return "ThaiD นี้มีในระบบแล้ว";
    if (msg.includes("Duplicate") && msg.includes("email")) return "Email นี้ถูกใช้งานแล้ว";
    return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function toggleUserActiveAction(userId: number, currentActive: boolean): Promise<void> {
  const actor = await requireAdmin();
  if (Number(actor.id) === userId) return;
  const target = await getUserAuditRow(userId);
  await executeStatement("UPDATE users SET is_active = ? WHERE id = ?", [currentActive ? 0 : 1, userId]);
  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "users",
    entityId: userId,
    summary: `${currentActive ? "ปิดใช้งาน" : "เปิดใช้งาน"} ผู้ใช้ ${target?.full_name ?? `#${userId}`}`,
  });
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
}

/**
 * SEC-04: เปิด/ปิดสิทธิ์ให้บัญชีนี้ผูก ThaiD ครั้งแรกด้วยชื่อ-นามสกุล
 * ต้องรัน database/add_thaid_link_approval.sql ก่อนจึงจะใช้งานได้
 */
export async function setThaidLinkEnabledAction(userId: number, enabled: boolean): Promise<string | null> {
  const actor = await requireAdmin();
  const target = await getUserAuditRow(userId);
  try {
    await executeStatement("UPDATE users SET thaid_link_enabled = ? WHERE id = ?", [enabled ? 1 : 0, userId]);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return "ฐานข้อมูลยังไม่มีคอลัมน์สำหรับฟังก์ชันนี้ กรุณาให้ผู้ดูแลระบบรัน database/add_thaid_link_approval.sql";
    }
    return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "users",
    entityId: userId,
    summary: `${enabled ? "เปิด" : "ปิด"}สิทธิ์เชื่อมต่อ ThaiD ให้ผู้ใช้ ${target?.full_name ?? `#${userId}`}`,
  });
  revalidatePath("/admin/users");
  return null;
}

export async function approveUserAction(userId: number): Promise<void> {
  await approveUsersAction([userId]);
}

export async function approveUsersAction(userIds: number[]): Promise<void> {
  const actor = await requireAdmin();
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const targets = await selectRows<UserAuditRow>(
    `SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS full_name, role FROM users
     WHERE id IN (${placeholders}) AND is_active = 0 AND last_login_at IS NULL`,
    uniqueIds
  );
  if (targets.length === 0) return;

  const targetIds = targets.map((target) => target.id);
  const targetPlaceholders = targetIds.map(() => "?").join(", ");
  await executeStatement(
    `UPDATE users SET is_active = 1 WHERE id IN (${targetPlaceholders}) AND is_active = 0 AND last_login_at IS NULL`,
    targetIds
  );
  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "users",
    entityId: targets.length === 1 ? targets[0].id : null,
    summary:
      targets.length === 1
        ? `อนุมัติผู้ใช้ ${targets[0].full_name}`
        : `อนุมัติผู้ลงทะเบียน ${targets.length} รายการ: ${targets.map((target) => target.full_name).join(", ")}`,
  });
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
}

export async function updateUserRoleAction(userId: number, newRole: "admin" | "officer" | "viewer"): Promise<void> {
  const actor = await requireAdmin();
  if (Number(actor.id) === userId) return;
  const before = await getUserAuditRow(userId);
  await executeStatement("UPDATE users SET role = ? WHERE id = ?", [newRole, userId]);
  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "users",
    entityId: userId,
    summary: `เปลี่ยนสิทธิ์ผู้ใช้ ${before?.full_name ?? `#${userId}`} (${before?.role ?? "-"} -> ${newRole})`,
  });
  revalidatePath("/admin/users");
}

export async function updateUserFacilityAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const actor = await requireAdmin();

  const userId = Number(fd.get("userId"));
  const role = (fd.get("role") as string | null) ?? "officer";
  const facilityIdRaw = (fd.get("facilityId") as string | null)?.trim() ?? "";
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  if (!userId || Number.isNaN(userId)) return "User ID ไม่ถูกต้อง";
  if (facilityId !== null && Number.isNaN(facilityId)) return "หน่วยงานไม่ถูกต้อง";
  if (role === "officer" && !facilityId) return "Officer ต้องมีหน่วยงาน";

  try {
    await executeStatement("UPDATE users SET facility_id = ? WHERE id = ?", [facilityId, userId]);
    const target = await getUserAuditRow(userId);
    await writeAuditLog({
      userId: actor.id,
      userName: actor.fullName,
      action: "update",
      entity: "users",
      entityId: userId,
      summary: `แก้ไขหน่วยงานผู้ใช้ ${target?.full_name ?? `#${userId}`} -> ${facilityId ?? "none"}`,
    });
    revalidatePath("/admin/users");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unknown column") && msg.includes("facility_id")) {
      return "กรุณารัน migration users.facility_id ก่อน";
    }
    return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  return null;
}

export async function resetUserPasswordAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const actor = await requireAdmin();

  const userId = Number(fd.get("userId"));
  const newPassword = (fd.get("newPassword") as string | null)?.trim() ?? "";

  if (!userId || isNaN(userId)) return "User ID ไม่ถูกต้อง";
  if (newPassword.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";

  const target = await getUserAuditRow(userId);
  const hash = hashPassword(newPassword);
  await executeStatement("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
  await writeAuditLog({
    userId: actor.id,
    userName: actor.fullName,
    action: "update",
    entity: "users",
    entityId: userId,
    summary: `รีเซ็ตรหัสผ่านผู้ใช้ ${target?.full_name ?? `#${userId}`}`,
  });
  revalidatePath("/admin/users");
  return null;
}
