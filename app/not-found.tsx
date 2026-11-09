import Image from "next/image";
import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { APP_NAME, APP_ORG } from "@/lib/app-brand";
import { withBasePath } from "@/lib/base-path";

// A2: readable Thai 404 instead of the framework default (white text on white).
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-16">
      <div className="relative isolate w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
        <PhotoBackdrop image="office-desk" opacity="opacity-[0.11]" fade="bottom" />
        <Image src={withBasePath("/logo.png")} alt="" width={56} height={56} className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-6 text-sm font-semibold text-[var(--accent-strong)]">ไม่พบหน้าที่ต้องการ (404)</p>
        <h1 className="section-title mt-2 text-2xl font-semibold text-[var(--foreground)]">ลิงก์นี้อาจถูกย้ายหรือไม่มีอยู่แล้ว</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          ตรวจสอบที่อยู่อีกครั้ง หรือกลับไปเริ่มจากรายการทรัพย์สิน ถ้าสแกน QR แล้วมาที่หน้านี้ ครุภัณฑ์รายการนั้นอาจถูกลบออกจากทะเบียนแล้ว
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/assets" className="primary-action justify-center"><AppIcon name="package" className="h-4 w-4" /> กลับรายการทรัพย์สิน</Link>
          <Link href="/dashboard" className="secondary-action justify-center gap-2"><AppIcon name="dashboard" className="h-4 w-4" /> หน้าภาพรวม</Link>
        </div>
        <p className="mt-8 text-xs text-[var(--muted)]">{APP_NAME} · {APP_ORG}</p>
      </div>
    </main>
  );
}
