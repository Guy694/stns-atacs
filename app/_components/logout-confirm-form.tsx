"use client";

import type { ReactNode } from "react";
import Swal from "sweetalert2";

import { resetSplash } from "@/app/_components/splash-screen";
import { withBasePath } from "@/lib/base-path";

const LOGOUT_NOTICE = "ออกจากระบบเรียบร้อยแล้ว";

type LogoutConfirmFormProps = {
  buttonClassName: string;
  buttonContent?: ReactNode;
  ariaLabel?: string;
  title?: string;
};

export function LogoutConfirmForm({ buttonClassName, buttonContent, ariaLabel, title }: LogoutConfirmFormProps) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const result = await Swal.fire({
      title: "ยืนยันการออกจากระบบ",
      text: "หากออกจากระบบตอนนี้ คุณจะต้องเข้าสู่ระบบใหม่อีกครั้ง",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#15803d",
      cancelButtonColor: "#6b7280",
      background: "#f8fffb",
      color: "#113127",
      customClass: {
        popup: "rounded-3xl border border-emerald-200 shadow-xl",
        title: "text-xl font-bold",
        confirmButton: "rounded-xl px-4 py-2 font-semibold",
        cancelButton: "rounded-xl px-4 py-2 font-semibold",
      },
    });

    if (!result.isConfirmed) return;

    resetSplash();
    try {
      // ลบ session ฝั่งเซิร์ฟเวอร์ก่อน แล้วพาไปหน้า login ทันที (replace = กด Back กลับมาหน้าเดิมไม่ได้)
      const response = await fetch(withBasePath("/logout/"), {
        method: "POST",
        credentials: "same-origin",
        redirect: "manual",
        cache: "no-store",
      });
      if (response.type !== "opaqueredirect" && !response.ok) throw new Error(`logout failed: ${response.status}`);
      window.location.replace(withBasePath(`/login?notice=${encodeURIComponent(LOGOUT_NOTICE)}`));
    } catch {
      // ถ้า fetch ใช้ไม่ได้ ให้ส่งฟอร์มแบบปกติ (เซิร์ฟเวอร์จะ redirect ไปหน้า login เอง)
      form.submit();
    }
  }

  return (
    <form action={withBasePath("/logout/")} method="post" onSubmit={handleSubmit}>
      <button type="submit" className={buttonClassName} aria-label={ariaLabel} title={title}>
        {buttonContent ?? "ออกจากระบบ"}
      </button>
    </form>
  );
}
