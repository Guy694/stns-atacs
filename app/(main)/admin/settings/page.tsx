import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";

type Section = {
  title: string;
  desc: string;
  icon: string;
  href?: string;
};

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = user.role === "admin"
    || (await hasPermission(user.role, "permissions.manage"))
    || (await hasPermission(user.role, "facilities.manage"))
    || (await hasPermission(user.role, "device-types.manage"));
  if (!allowed) redirect("/");

  const settingSections: Section[] = [
    {
      title: "จัดการบทบาทผู้ใช้",
      desc: "Admin, Officer, Viewer — จัดการได้ที่หน้าผู้ใช้งาน",
      icon: "🔑",
      href: "/admin/users",
    },
    {
      title: "จัดการหน่วยงาน",
      desc: "เพิ่ม/แก้ไข/ปิดใช้ รพ.สตูล, รพ.ชุมชน, รพ.สต. ทุกแห่ง",
      icon: "🏥",
      href: "/admin/settings/facilities",
    },
    {
      title: "จัดการประเภทอุปกรณ์",
      desc: "Server, Notebook, Firewall, Switch … — สำหรับ dropdown ในฟอร์ม",
      icon: "🗂️",
      href: "/admin/settings/device-types",
    },
    {
      title: "ATACS Agent",
      desc: "สร้าง enrollment token ให้หน่วยงานติดตั้ง agent และรับ inventory อัตโนมัติ",
      icon: "🖥️",
      href: "/admin/settings/agent",
    },
    {
      title: "Permission Matrix",
      desc: "กำหนดสิทธิ์รายบทบาทแบบละเอียด ทั้งเมนูและ action",
      icon: "🧩",
      href: "/admin/settings/permissions",
    },
    {
      title: "ประวัติการใช้งาน (Audit Log)",
      desc: "ดูว่าใครแก้ไขข้อมูลอะไร เมื่อไหร่",
      icon: "📝",
      href: "/admin/audit",
    },
    { title: "จัดการสถานะทรัพย์สิน", desc: "Active, Inactive, Broken, Disposed, Lost…", icon: "🔵" },
    { title: "จัดการยี่ห้อ / รุ่น", desc: "Manufacturer catalog", icon: "🏷️" },
    { title: "ตั้งค่าปีงบประมาณ", desc: "กำหนดรอบตรวจนับ, ปีงบประมาณ", icon: "📅" },
    { title: "ตั้งค่ารหัสครุภัณฑ์", desc: "รูปแบบ prefix และการออกเลขอัตโนมัติ", icon: "🔢" },
    { title: "ตั้งค่า QR Code", desc: "รูปแบบ QR, ขนาด, โลโก้", icon: "⬡" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · ตั้งค่าระบบ</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ตั้งค่าระบบ</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingSections.map((s) =>
          s.href ? (
            <Link
              key={s.title}
              href={s.href}
              className="glass-panel flex items-start gap-4 rounded-2xl p-5 transition hover:shadow-md hover:-translate-y-0.5"
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  พร้อมใช้งาน →
                </span>
              </div>
            </Link>
          ) : (
            <div key={s.title} className="glass-panel flex items-start gap-4 rounded-2xl p-5 opacity-60">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
                <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  อยู่ระหว่างพัฒนา
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
