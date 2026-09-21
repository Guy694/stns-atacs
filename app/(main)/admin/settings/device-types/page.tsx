import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listDeviceTypes } from "@/lib/device-types";
import { DeviceTypesClient } from "./_components/device-types-client";

export const dynamic = "force-dynamic";

export default async function AdminDeviceTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const items = await listDeviceTypes();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/admin/settings" className="hover:underline">ตั้งค่าระบบ</Link>
        <span>›</span>
        <span>จัดการประเภทอุปกรณ์</span>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · ตั้งค่าระบบ</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">จัดการประเภทอุปกรณ์</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ประเภทอุปกรณ์ที่ปรากฏใน dropdown ฟอร์มเพิ่มทรัพย์สิน</p>
      </div>

      <Link href="/assets/subtypes" className="text-sm underline">จัดการประเภทย่อยครุภัณฑ์นอกกลุ่ม IT</Link>
      <DeviceTypesClient items={items} />
    </div>
  );
}
