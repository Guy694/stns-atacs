"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { createAsset, deleteAsset, updateAsset, type AssetInput } from "@/lib/assets";

function requireAuth() {
  // This will throw/redirect if not logged in — called inside action
  return getCurrentUser();
}

function readStr(fd: FormData, key: string) {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

function readOptional(fd: FormData, key: string) {
  const v = readStr(fd, key);
  return v === "" ? undefined : v;
}

function buildInput(fd: FormData, updaterName: string): AssetInput {
  const surveyId = Number(fd.get("surveyId"));
  if (!surveyId || isNaN(surveyId)) throw new Error("กรุณาเลือกหน่วยงาน");

  const assetRegistrationNo = readStr(fd, "assetRegistrationNo");
  if (!assetRegistrationNo) throw new Error("กรุณากรอกเลขทะเบียนทรัพย์สิน");

  const assetName = readStr(fd, "assetName");
  if (!assetName) throw new Error("กรุณากรอกชื่อทรัพย์สิน");

  const assetCategory = readStr(fd, "assetCategory") as "Hardware" | "Software";
  if (!["Hardware", "Software"].includes(assetCategory)) throw new Error("หมวดทรัพย์สินไม่ถูกต้อง");

  return {
    surveyId,
    assetRegistrationNo,
    assetName,
    assetCategory,
    usageDescription: readOptional(fd, "usageDescription"),
    ownerName: readOptional(fd, "ownerName"),
    deviceType: readOptional(fd, "deviceType"),
    operatingSystem: readOptional(fd, "operatingSystem"),
    operatingSystemVersion: readOptional(fd, "operatingSystemVersion"),
    privateIp: readOptional(fd, "privateIp"),
    publicIp: readOptional(fd, "publicIp"),
    locationDetail: readOptional(fd, "locationDetail"),
    currentStatus: readOptional(fd, "currentStatus") ?? "Active",
    updatedBy: updaterName,
    manufacturerBrand: readOptional(fd, "manufacturerBrand"),
    manufacturerModel: readOptional(fd, "manufacturerModel"),
    serialNumber: readOptional(fd, "serialNumber"),
    maintenanceStartDate: readOptional(fd, "maintenanceStartDate"),
    maintenanceEndDate: readOptional(fd, "maintenanceEndDate"),
    installedAt: readOptional(fd, "installedAt"),
    lastUpdatedAt: new Date().toISOString().slice(0, 10),
  };
}

export async function createAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (!user) redirect("/login");

  try {
    const input = buildInput(fd, user.fullName);
    await createAsset(input);
    revalidatePath("/assets");
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function updateAssetAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const id = Number(fd.get("assetId"));
  if (!id || isNaN(id)) return "ID ทรัพย์สินไม่ถูกต้อง";

  try {
    const input = buildInput(fd, user.fullName);
    await updateAsset(id, input);
    revalidatePath("/assets");
    revalidatePath("/");
    revalidatePath(`/facilities/${input.surveyId}`);
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}

export async function deleteAssetAction(id: number): Promise<string | null> {
  const user = await requireAuth();
  if (!user) redirect("/login");
  if (user.role !== "admin") return "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบทรัพย์สินได้";

  try {
    await deleteAsset(id);
    revalidatePath("/assets");
    revalidatePath("/");
  } catch (err) {
    return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }
  return null;
}
