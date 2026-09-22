"use client";

import type { ReactNode } from "react";
import Swal from "sweetalert2";

import { resetSplash } from "@/app/_components/splash-screen";

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

    if (result.isConfirmed) {
      resetSplash();
      form.submit();
    }
  }

  return (
    <form action="/logout" method="post" onSubmit={handleSubmit}>
      <button type="submit" className={buttonClassName} aria-label={ariaLabel} title={title}>
        {buttonContent ?? "ออกจากระบบ"}
      </button>
    </form>
  );
}
