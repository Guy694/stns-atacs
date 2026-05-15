"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAgentEnrollment } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { executeStatement, selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

async function requireOfficerWithFacility() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.facilityId) throw new Error("NO_FACILITY");
  return user;
}

type TokenRow = RowDataPacket & { id: number };

/** สร้าง token ใหม่สำหรับ officer self-service (revoke อันเก่าก่อน) */
export async function createOfficerDownloadTokenAction(): Promise<{
  token: string | null;
  error: string | null;
}> {
  let user;
  try {
    user = await requireOfficerWithFacility();
  } catch {
    return { token: null, error: "บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const enrollmentName = `self-service:officer-${user.id}`;

  // revoke token เดิมของ officer คนนี้ก่อน
  try {
    const old = await selectRows<TokenRow>(
      "SELECT id FROM agent_enrollments WHERE enrollment_name = ? AND is_active = 1",
      [enrollmentName]
    );
    for (const row of old) {
      await executeStatement("UPDATE agent_enrollments SET is_active = 0 WHERE id = ?", [row.id]);
    }
  } catch {
    // ถ้า table ยังไม่มีก็ข้ามไป
  }

  try {
    const token = await createAgentEnrollment({
      facilityId: user.facilityId!,
      enrollmentName,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19),
      createdByUserId: Number(user.id),
    });
    revalidatePath("/agent-download");
    return { token, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("agent_enrollments")) {
      return { token: null, error: "ยังไม่พบตาราง agent_enrollments กรุณารัน database/agent_inventory.sql ก่อน" };
    }
    return { token: null, error: "ไม่สามารถสร้าง enrollment token ได้" };
  }
}
