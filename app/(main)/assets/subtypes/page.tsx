import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";
import { listAssetSubtypes } from "@/lib/asset-extensions";
import { SubtypeForm } from "./subtype-form";

export default async function AssetSubtypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "device-types.manage"))) redirect("/assets");
  const items = await listAssetSubtypes();
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <Link href="/assets" className="text-sm underline">กลับทะเบียนทรัพย์สิน</Link>
    <h1 className="text-2xl font-semibold">ประเภทย่อยครุภัณฑ์</h1>
    <p className="text-sm">ปิดใช้งานเพื่อหยุดการเลือกในรายการใหม่ โดยข้อมูลครุภัณฑ์เดิมยังคงอยู่</p>
    <section aria-label="เพิ่มประเภทย่อย"><SubtypeForm /></section>
    <section aria-label="ประเภทย่อยทั้งหมด">{items.map(item => <SubtypeForm key={`${item.id}-${item.name}-${item.isActive}`} item={item} />)}</section>
  </main>;
}
