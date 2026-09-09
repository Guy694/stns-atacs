"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  clearPendingRegistrationClaim,
  createSession,
  createOfficerFromPassword,
  createUserFromGoogle,
  createUserFromThaiD,
  destroySession,
  findUserByThaiCid,
  findUserByUsername,
  getUserDisplayName,
  getPendingRegistrationClaim,
  normalizeDisplayName,
  normalizeThaiCid,
  setPendingThaiDRegistrationClaim,
  validatePasswordLoginInput,
  validateOfficerRegistrationInput,
  validateThaiDLoginInput,
  verifyPassword,
} from "@/lib/auth";
import { notifyTelegramSafe } from "@/lib/telegram";
import { recordSecurityEvent } from "@/lib/security";

function toQuery(message: string) {
  return encodeURIComponent(message);
}

function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  return value;
}

async function requestDetails() {
  const requestHeaders = await headers();
  return {
    IP: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? "unknown",
    "User Agent": requestHeaders.get("user-agent") ?? "unknown",
  };
}

async function recordLoginSecurityEvent(eventType: string, identity: string, detail: string) {
  const context = await requestDetails();
  await recordSecurityEvent({
    eventType,
    ipAddress: context.IP,
    identity,
    path: "/login",
    detail,
  });
  return context;
}

function loginSystemErrorRedirect(nextPath: string) {
  redirect(
    `/login?tab=password&next=${encodeURIComponent(nextPath)}&error=${toQuery(
      "ระบบเข้าสู่ระบบยังตั้งค่าฐานข้อมูลบน production ไม่ครบ กรุณาตรวจสอบ auth_sessions และ migration สำหรับ password login"
    )}`
  );
}

function maskThaiCid(cid: string) {
  return cid.length === 13 ? `${cid.slice(0, 3)}******${cid.slice(-4)}` : "invalid";
}

export async function loginWithThaiDAction(formData: FormData) {
  const thaiCid = normalizeThaiCid(String(formData.get("thaidCid") ?? ""));
  const displayName = normalizeDisplayName(String(formData.get("displayName") ?? ""));

  const inputError = validateThaiDLoginInput(thaiCid, displayName);
  if (inputError) {
    const context = await recordLoginSecurityEvent("login_invalid_input", maskThaiCid(thaiCid), inputError);
    await notifyTelegramSafe({
      category: "security",
      title: "พยายามเข้าสู่ระบบด้วย ThaiD แต่ข้อมูลไม่ถูกต้อง",
      details: { ThaiD: maskThaiCid(thaiCid), ...context },
    });
    redirect(`/login?error=${toQuery(inputError)}`);
  }

  const user = await findUserByThaiCid(thaiCid);
  if (user) {
    if (!user.is_active) {
      const context = await recordLoginSecurityEvent("login_pending_account", maskThaiCid(thaiCid), "ThaiD");
      await notifyTelegramSafe({
        category: "security",
        title: "บัญชีที่ยังไม่ได้รับอนุมัติพยายามเข้าสู่ระบบ",
        details: { ผู้ใช้: getUserDisplayName(user), วิธี: "ThaiD", ...context },
      });
      redirect("/pending-approval");
    }
    await clearPendingRegistrationClaim();
    await createSession(user.id);
    await notifyTelegramSafe({
      category: "security",
      title: "เข้าสู่ระบบสำเร็จ",
      details: { ผู้ใช้: getUserDisplayName(user), วิธี: "ThaiD", ...(await requestDetails()) },
    });
    redirect("/");
  }

  await setPendingThaiDRegistrationClaim(thaiCid, displayName);
  redirect(`/register?notice=${toQuery("ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาสมัครสมาชิกครั้งแรก")}`);
}

export async function registerFirstTimeAction(formData: FormData) {
  const claim = await getPendingRegistrationClaim();

  if (!claim) {
    redirect(`/login?error=${toQuery("เซสชันยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบใหม่")}`);
  }

  const firstName = normalizeDisplayName(String(formData.get("firstName") ?? ""));
  const lastName = normalizeDisplayName(String(formData.get("lastName") ?? ""));
  const fullName = normalizeDisplayName(`${firstName} ${lastName}`);
  const officerPosition = normalizeDisplayName(String(formData.get("officerPosition") ?? ""));
  const facilityIdRaw = String(formData.get("facilityId") ?? "").trim();
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  if (!firstName) {
    redirect(`/register?error=${toQuery("กรุณาระบุชื่อ")}`);
  }
  if (!lastName) {
    redirect(`/register?error=${toQuery("กรุณาระบุนามสกุล")}`);
  }
  if (officerPosition.length < 2 || officerPosition.length > 150) {
    redirect(`/register?error=${toQuery("กรุณาระบุตำแหน่งเจ้าหน้าที่ให้ครบถ้วน")}`);
  }
  if (!facilityId || !Number.isInteger(facilityId)) {
    redirect(`/register?error=${toQuery("กรุณาเลือกหน่วยงานที่สังกัด")}`);
  }

  if (claim.provider === "thaid") {
    const thaiCid = normalizeThaiCid(String(formData.get("thaidCid") ?? ""));
    const emailInput = String(formData.get("email") ?? "").trim().toLowerCase();
    const email = emailInput || undefined;

    if (thaiCid !== claim.cid) {
      redirect(`/register?error=${toQuery("ข้อมูล ThaiD ไม่ตรงกับรอบยืนยันล่าสุด")}`);
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
      await createUserFromThaiD({ thaiCid, firstName, lastName, officerPosition, email, facilityId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("Duplicate") || errorMessage.includes("duplicate")) {
        redirect(`/register?error=${toQuery("เลข ThaiD หรืออีเมลนี้ถูกใช้งานแล้ว")}`);
      }
      redirect(`/register?error=${toQuery("เกิดข้อผิดพลาดในการสมัครสมาชิก")}`);
    }
    await notifyTelegramSafe({
      category: "registration",
      title: "มีผู้ลงทะเบียนใหม่ รอการอนุมัติ",
      details: { ชื่อ: fullName, ตำแหน่ง: officerPosition, อีเมล: email, ThaiD: maskThaiCid(thaiCid), หน่วยงาน: facilityId, วิธี: "ThaiD" },
    });
    await clearPendingRegistrationClaim();
    redirect("/pending-approval");
  }

  try {
    await createUserFromGoogle({
      googleSub: claim.googleSub,
      firstName,
      lastName,
      officerPosition,
      email: claim.email,
      facilityId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage.includes("Duplicate") || errorMessage.includes("duplicate")) {
      redirect(`/register?error=${toQuery("บัญชี Google หรืออีเมลนี้ถูกใช้งานแล้ว")}`);
    }
    redirect(`/register?error=${toQuery("เกิดข้อผิดพลาดในการสมัครสมาชิก")}`);
  }
  await notifyTelegramSafe({
    category: "registration",
    title: "มีผู้ลงทะเบียนใหม่ รอการอนุมัติ",
    details: { ชื่อ: fullName, ตำแหน่ง: officerPosition, อีเมล: claim.email, หน่วยงาน: facilityId, วิธี: "Google" },
  });
  await clearPendingRegistrationClaim();
  redirect("/pending-approval");
}

export async function registerOfficerWithPasswordAction(formData: FormData) {
  const firstName = normalizeDisplayName(String(formData.get("firstName") ?? ""));
  const lastName = normalizeDisplayName(String(formData.get("lastName") ?? ""));
  const fullName = normalizeDisplayName(`${firstName} ${lastName}`);
  const officerPosition = normalizeDisplayName(String(formData.get("officerPosition") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const facilityIdRaw = String(formData.get("facilityId") ?? "").trim();
  const facilityId = facilityIdRaw ? Number(facilityIdRaw) : null;

  const inputError = validateOfficerRegistrationInput({
    firstName,
    lastName,
    officerPosition,
    email,
    username,
    password,
    confirmPassword,
    facilityId,
  });
  if (inputError) {
    await recordLoginSecurityEvent("officer_registration_invalid", username || email || "(empty)", inputError);
    redirect(`/login?register=1&error=${toQuery(inputError)}`);
  }

  if (await findUserByUsername(username)) {
    redirect(`/login?register=1&error=${toQuery("Username นี้ถูกใช้งานแล้ว กรุณาเลือก Username อื่น")}`);
  }

  try {
    await createOfficerFromPassword({
      firstName,
      lastName,
      officerPosition,
      email,
      username,
      password,
      facilityId: facilityId!,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    await recordLoginSecurityEvent("officer_registration_failed", username, message || "Database error");
    if (message.toLowerCase().includes("duplicate")) {
      redirect(`/login?register=1&error=${toQuery("Username หรืออีเมลนี้ถูกใช้งานแล้ว")}`);
    }
    redirect(`/login?register=1&error=${toQuery("ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่")}`);
  }

  await notifyTelegramSafe({
    category: "registration",
    title: "เจ้าหน้าที่ลงทะเบียนใหม่ รอการอนุมัติ",
    details: {
      ชื่อ: fullName,
      ตำแหน่ง: officerPosition,
      อีเมล: email,
      Username: username,
      หน่วยงาน: facilityId,
      วิธี: "Username/Password",
      ...(await requestDetails()),
    },
  });
  redirect("/pending-approval");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login?notice=ออกจากระบบเรียบร้อยแล้ว");
}

export async function loginWithPasswordAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  const inputError = validatePasswordLoginInput(username, password);
  if (inputError) {
    const context = await recordLoginSecurityEvent("login_invalid_input", username || "(empty)", inputError);
    await notifyTelegramSafe({
      category: "security",
      title: "พยายามเข้าสู่ระบบด้วย Username แต่ข้อมูลไม่ครบ",
      details: { Username: username || "(ว่าง)", ...context },
    });
    redirect(`/login?tab=password&next=${encodeURIComponent(nextPath)}&error=${toQuery(inputError)}`);
  }

  let user;
  try {
    user = await findUserByUsername(username);
  } catch (error) {
    console.error("Password login lookup failed", error);
    loginSystemErrorRedirect(nextPath);
  }

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    const context = await recordLoginSecurityEvent("login_failed_password", username, "Username/Password ไม่ถูกต้อง");
    await notifyTelegramSafe({
      category: "security",
      title: "เข้าสู่ระบบไม่สำเร็จ",
      details: { Username: username, วิธี: "Username/Password", ...context },
    });
    redirect(`/login?tab=password&next=${encodeURIComponent(nextPath)}&error=${toQuery("Username หรือรหัสผ่านไม่ถูกต้อง")}`);
  }

  if (user.is_active === 0) {
    const context = await recordLoginSecurityEvent("login_pending_account", username, "บัญชียังไม่ได้รับอนุมัติ");
    await notifyTelegramSafe({
      category: "security",
      title: "บัญชีที่ยังไม่ได้รับอนุมัติพยายามเข้าสู่ระบบ",
      details: { ผู้ใช้: getUserDisplayName(user), Username: username, ...context },
    });
    redirect("/pending-approval");
  }
  if (!user.is_active) {
    redirect(`/login?tab=password&next=${encodeURIComponent(nextPath)}&error=${toQuery("บัญชีผู้ใช้ถูกระงับการใช้งาน")}`);
  }

  try {
    await createSession(user.id);
  } catch (error) {
    console.error("Password login session creation failed", error);
    loginSystemErrorRedirect(nextPath);
  }

  await notifyTelegramSafe({
    category: "security",
    title: "เข้าสู่ระบบสำเร็จ",
    details: { ผู้ใช้: getUserDisplayName(user), Username: username, วิธี: "Username/Password", ...(await requestDetails()) },
  });
  redirect(nextPath);
}
