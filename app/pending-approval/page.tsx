import Link from "next/link";

import { TopNavigation } from "@/app/_components/top-navigation";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";

export default function PendingApprovalPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
      <TopNavigation current="login" user={null} />
      <section className="relative isolate mt-4 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white p-6 text-center sm:p-8">
        <PhotoBackdrop image="meeting-room" opacity="opacity-[0.11]" fade="bottom" />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)]"><AppIcon name="history" className="h-8 w-8" /></div>
        <h1 className="section-title text-3xl font-semibold">รอการอนุมัติ</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          ระบบได้รับข้อมูลการสมัครสมาชิกของคุณแล้ว กรุณารอให้ผู้ดูแลระบบอนุมัติการเข้าใช้งานก่อน
          เมื่ออนุมัติแล้ว คุณสามารถล็อกอินเข้าใช้งานได้ทันที
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          หากรอนานผิดปกติ กรุณาติดต่อผู้ดูแลระบบ ATACS โดยตรง
        </div>
        <Link href="/login" className="secondary-action mt-6">
          <AppIcon name="arrow-left" className="h-4 w-4" /> กลับหน้าล็อกอิน
        </Link>
      </section>
    </main>
  );
}
