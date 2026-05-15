"use server";

import { redirect } from "next/navigation";

import {
  clearPendingRegistrationClaim,
  createSession,
  createUserFromThaiD,
  destroySession,
  findUserByThaiCid,
  findUserByUsername,
  getPendingRegistrationClaim,
  normalizeDisplayName,
  normalizeThaiCid,
  setPendingRegistrationClaim,
  validatePasswordLoginInput,
  validateThaiDLoginInput,
  verifyPassword,
} from "@/lib/auth";

function toQuery(message: string) {
  return encodeURIComponent(message);
}

export async function loginWithThaiDAction(formData: FormData) {
  const thaiCid = normalizeThaiCid(String(formData.get("thaidCid") ?? ""));
  const displayName = normalizeDisplayName(String(formData.get("displayName") ?? ""));

  const inputError = validateThaiDLoginInput(thaiCid, displayName);
  if (inputError) {
    redirect(`/login?error=${toQuery(inputError)}`);
  }

  const user = await findUserByThaiCid(thaiCid);
  if (user) {
    if (!user.is_active) {
      redirect("/pending-approval");
    }
    await clearPendingRegistrationClaim();
    await createSession(user.id);
    redirect("/");
  }

  await setPendingRegistrationClaim(thaiCid, displayName);
  redirect(`/register?notice=${toQuery("ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาสมัครสมาชิกครั้งแรก")}`);
}

export async function registerFromThaiDAction(formData: FormData) {
  const claim = await getPendingRegistrationClaim();

  if (!claim) {
    redirect(`/login?error=${toQuery("เซสชันยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบผ่าน ThaiD ใหม่")}`);
  }

  const thaiCid = normalizeThaiCid(String(formData.get("thaidCid") ?? ""));
  const fullName = normalizeDisplayName(String(formData.get("fullName") ?? ""));
  const emailInput = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailInput || undefined;
  const facilityIdRaw = String(formData.get("facilityId") ?? "").trim();
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  if (thaiCid !== claim.cid) {
    redirect(`/register?error=${toQuery("ข้อมูล ThaiD ไม่ตรงกับรอบยืนยันล่าสุด")}`);
  }

  if (!fullName) {
    redirect(`/register?error=${toQuery("กรุณาระบุชื่อ-นามสกุล")}`);
  }

  const existingUser = await findUserByThaiCid(thaiCid);
  if (existingUser) {
    await clearPendingRegistrationClaim();
    if (!existingUser.is_active) {
      redirect("/pending-approval");
    }
    await createSession(existingUser.id);
    redirect("/");
  }

  try {
    const createdUser = await createUserFromThaiD({
      thaiCid,
      fullName,
      email,
      facilityId,
    });

    if (!createdUser) {
      redirect(`/register?error=${toQuery("ไม่สามารถสร้างผู้ใช้งานได้ กรุณาลองใหม่")}`);
    }

    await clearPendingRegistrationClaim();
    redirect("/pending-approval");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "ไม่สามารถสมัครสมาชิกได้";
    if (errorMessage.includes("Duplicate") || errorMessage.includes("duplicate")) {
      redirect(`/register?error=${toQuery("เลข ThaiD หรืออีเมลนี้ถูกใช้งานแล้ว")}`);
    }

    redirect(`/register?error=${toQuery("เกิดข้อผิดพลาดในการสมัครสมาชิก")}`);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login?notice=ออกจากระบบเรียบร้อยแล้ว");
}

export async function loginWithPasswordAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const inputError = validatePasswordLoginInput(username, password);
  if (inputError) {
    redirect(`/login?tab=password&error=${toQuery(inputError)}`);
  }

  const user = await findUserByUsername(username);

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    redirect(`/login?tab=password&error=${toQuery("Username หรือรหัสผ่านไม่ถูกต้อง")}`);
  }

  if (user.is_active === 0) {
    redirect("/pending-approval");
  }
  if (!user.is_active) {
    redirect(`/login?tab=password&error=${toQuery("บัญชีผู้ใช้ถูกระงับการใช้งาน")}`);
  }

  await createSession(user.id);
  redirect("/");
}