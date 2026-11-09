"use client";

import { useEffect } from "react";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { withBasePath } from "@/lib/base-path";

/** ข้อผิดพลาดภายในหน้าใดหน้าหนึ่ง — เมนู/เลย์เอาต์ยังอยู่ ผู้ใช้ไปหน้าอื่นต่อได้ */
export default function MainSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch(withBasePath("/api/client-error/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        where: "page",
        name: error.name,
        message: error.message,
        digest: error.digest,
        path: typeof window === "undefined" ? null : window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div role="alert" className="relative isolate mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-6 text-center">
      <PhotoBackdrop image="it-storage" opacity="opacity-[0.10]" fade="bottom" />
      <AppIcon name="warning" className="mx-auto mb-2 h-8 w-8 text-[var(--state-warning-fg)]" />
      <h1 className="text-lg font-semibold">เปิดหน้านี้ไม่สำเร็จ</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        ระบบบันทึกข้อผิดพลาดให้ผู้ดูแลแล้ว ลองใหม่อีกครั้ง หรือกลับไปหน้าอื่นก่อนได้
      </p>
      {error.digest && <p className="mt-2 text-xs text-[var(--muted)]">รหัสอ้างอิง: {error.digest}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="primary-action">
          <AppIcon name="refresh" className="h-4 w-4" /> ลองใหม่อีกครั้ง
        </button>
        <a href={withBasePath("/dashboard/")} className="secondary-action gap-2">
          <AppIcon name="dashboard" className="h-4 w-4" /> ไปหน้าแดชบอร์ด
        </a>
      </div>
    </div>
  );
}
