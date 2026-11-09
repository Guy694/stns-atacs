import { redirect } from "next/navigation";
import Link from "next/link";
import { AppIcon } from "@/app/_components/ui/icon";
import { getCurrentUser } from "@/lib/auth";
import { listDeviceTypes } from "@/lib/device-types";
import { DeviceTypesClient } from "./_components/device-types-client";
import { PageHero, SettingsBreadcrumb } from "@/app/(main)/admin/_components/page-hero";

export const dynamic = "force-dynamic";

export default async function AdminDeviceTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const items = await listDeviceTypes();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <SettingsBreadcrumb current="จัดการประเภทอุปกรณ์" />
      <PageHero
        icon="layers"
        image="it-storage"
        title="จัดการประเภทอุปกรณ์"
        description="ประเภทอุปกรณ์ที่ปรากฏใน dropdown ฟอร์มเพิ่มทรัพย์สิน"
      />

      <Link href="/assets/subtypes" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-[var(--primary-text)] hover:underline">
        <AppIcon name="tag" size={15} />
        จัดการประเภทย่อยครุภัณฑ์นอกกลุ่ม IT
        <AppIcon name="chevron-right" size={15} />
      </Link>
      <DeviceTypesClient items={items} />
    </div>
  );
}
