import Link from "next/link";

import { TopNavigation } from "@/app/_components/top-navigation";

export default function PendingApprovalPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
      <TopNavigation current="login" user={null} />
      <section className="glass-panel rounded-[2rem] border border-black/10 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Pending Approval</p>
        <h1 className="section-title mt-3 text-3xl font-semibold">รอการอนุมัติ</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          ระบบได้รับข้อมูลการสมัครสมาชิกของคุณแล้ว กรุณารอให้ผู้ดูแลระบบอนุมัติการเข้าใช้งานก่อน
          เมื่ออนุมัติแล้ว คุณสามารถล็อกอินเข้าใช้งานได้ทันที
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          หากรอนานผิดปกติ กรุณาติดต่อผู้ดูแลระบบ ATACS โดยตรง
        </div>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-stone-100"
        >
          กลับหน้าล็อกอิน
        </Link>
      </section>
    </main>
  );
}
