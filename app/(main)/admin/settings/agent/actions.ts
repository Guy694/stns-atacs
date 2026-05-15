"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAgentEnrollment, revokeAgentEnrollment } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import type { AgentEnrollmentActionState } from "./types";
import { agentEnrollmentInitialState } from "./types";

export type { AgentEnrollmentActionState } from "./types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function createAgentEnrollmentAction(
  _prev: AgentEnrollmentActionState,
  formData: FormData
): Promise<AgentEnrollmentActionState> {
  const user = await requireAdmin();

  const facilityId = Number(formData.get("facilityId"));
  const facilityName = (formData.get("facilityLabel") as string | null)?.trim() ?? "";
  const enrollmentName = (formData.get("enrollmentName") as string | null)?.trim() ?? "";
  const expiresAt = (formData.get("expiresAt") as string | null)?.trim() ?? "";

  if (!facilityId || Number.isNaN(facilityId)) {
    return { ...agentEnrollmentInitialState, error: "กรุณาเลือกหน่วยงาน" };
  }

  try {
    const createdToken = await createAgentEnrollment({
      facilityId,
      enrollmentName,
      expiresAt,
      createdByUserId: Number(user.id),
    });
    revalidatePath("/admin/settings/agent");
    return {
      error: null,
      createdToken,
      facilityName: facilityName || null,
      enrollmentName: enrollmentName || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("agent_enrollments")) {
      return { ...agentEnrollmentInitialState, error: "ยังไม่พบตาราง agent_enrollments กรุณารัน database/agent_inventory.sql ก่อน" };
    }
    return { ...agentEnrollmentInitialState, error: "ไม่สามารถสร้าง enrollment token ได้" };
  }
}

export async function revokeAgentEnrollmentAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("enrollmentId"));
  if (!id || Number.isNaN(id)) return;
  await revokeAgentEnrollment(id);
  revalidatePath("/admin/settings/agent");
}
