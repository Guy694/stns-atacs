import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityAgentContext } from "@/lib/facility-work-groups";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

type Section = {
  title: string;
  desc: string;
  icon: IconName;
  href?: string;
  permissionKey?: PermissionKey;
};

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const permissionEntries = [
    "permissions.manage",
    "facilities.manage",
    "device-types.manage",
    "work-groups.manage",
    "agent.manage",
    "users.manage",
    "audit.view",
  ] as const;
  const permissionChecks = await Promise.all(permissionEntries.map((permission) => hasPermission(user.role, permission)));
  if (user.role === "officer" && permissionChecks[3]) {
    const facility = user.facilityId ? await getFacilityAgentContext(Number(user.facilityId)) : null;
    if (!facility?.requiresWorkGroup) {
      permissionChecks[3] = false;
    }
  }
  const allowed = user.role === "admin" || permissionChecks.some(Boolean);
  if (!allowed) redirect("/dashboard");

  const settingSections: Section[] = [
    {
      title: "จัดการบทบาทผู้ใช้",
      desc: "Admin, Officer, Viewer — จัดการได้ที่หน้าผู้ใช้งาน",
      icon: "key",
      href: "/admin/users",
      permissionKey: "users.manage",
    },
    {
      title: "จัดการหน่วยงาน",
      desc: "เพิ่ม/แก้ไข/ปิดใช้ รพ.สตูล, รพ.ชุมชน, รพ.สต. ทุกแห่ง",
      icon: "building",
      href: "/admin/settings/facilities",
      permissionKey: "facilities.manage",
    },
    {
      title: "จัดการประเภทอุปกรณ์",
      desc: "Server, Notebook, Firewall, Switch … — สำหรับ dropdown ในฟอร์ม",
      icon: "layers",
      href: "/admin/settings/device-types",
      permissionKey: "device-types.manage",
    },
    {
      title: "จัดการกลุ่มงาน",
      desc: "สร้างกลุ่มงานของ สสจ, สสอ และโรงพยาบาลสำหรับติดตั้ง ATACS Agent",
      icon: "building",
      href: "/admin/settings/work-groups",
      permissionKey: "work-groups.manage",
    },
    {
      title: "ATACS Agent",
      desc: "สร้าง enrollment token ให้หน่วยงานติดตั้ง agent และรับ inventory อัตโนมัติ",
      icon: "monitor",
      href: "/admin/settings/agent",
      permissionKey: "agent.manage",
    },
    {
      title: "Authentication",
      desc: "เปิด/ปิด ThaiD login สำหรับผู้ใช้งานทั้งระบบ",
      icon: "shield",
      href: "/admin/settings/auth",
      permissionKey: "permissions.manage",
    },
    {
      title: "การแสดงเมนู",
      desc: "เปิด/ปิดเมนูหลักที่แสดงใน sidebar สำหรับผู้ใช้งานทั้งระบบ",
      icon: "settings",
      href: "/admin/settings/menus",
      permissionKey: "permissions.manage",
    },
    {
      title: "Permission Matrix",
      desc: "กำหนดสิทธิ์รายบทบาทแบบละเอียด ทั้งเมนูและ action",
      icon: "shield",
      href: "/admin/settings/permissions",
      permissionKey: "permissions.manage",
    },
    {
      title: "ประวัติการใช้งาน (Audit Log)",
      desc: "ดูว่าใครแก้ไขข้อมูลอะไร เมื่อไหร่",
      icon: "audit",
      href: "/admin/audit",
      permissionKey: "audit.view",
    },
    { title: "จัดการสถานะทรัพย์สิน", desc: "พร้อมใช้งาน, ไม่ใช้งาน, ชำรุด, จำหน่ายแล้ว, สูญหาย…", icon: "activity" },
    { title: "จัดการยี่ห้อ / รุ่น", desc: "Manufacturer catalog", icon: "tag" },
    { title: "ตั้งค่าปีงบประมาณ", desc: "กำหนดรอบตรวจนับ, ปีงบประมาณ", icon: "file-text" },
    { title: "ตั้งค่ารหัสครุภัณฑ์", desc: "รูปแบบ prefix และการออกเลขอัตโนมัติ", icon: "database" },
    { title: "ตั้งค่า QR Code", desc: "รูปแบบ QR, ขนาด, โลโก้", icon: "package" },
  ];

  const grantedPermissionKeys = user.role === "admin"
    ? new Set<PermissionKey>()
    : new Set(
        permissionEntries
          .map((permission, index) => [permission, permissionChecks[index]] as const)
          .filter(([, granted]) => granted)
          .map(([key]) => key)
      );

  const allowedSections = user.role === "admin"
    ? settingSections
    : settingSections.filter((section) => section.href && section.permissionKey && grantedPermissionKeys.has(section.permissionKey));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · ตั้งค่าระบบ</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ตั้งค่าระบบ</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowedSections.map((s) =>
          s.href ? (
            <Link
              key={s.title}
              href={s.href}
              className="glass-panel flex items-start gap-4 rounded-2xl p-5 transition hover:shadow-md hover:-translate-y-0.5"
            >
              <span className="rounded-xl bg-[var(--primary-soft)] p-2 text-[var(--primary-text)]">
                <AppIcon name={s.icon} />
              </span>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
                <StatusBadge tone="success" className="mt-2 text-[10px]">
                  พร้อมใช้งาน →
                </StatusBadge>
              </div>
            </Link>
          ) : (
            <div key={s.title} className="glass-panel flex items-start gap-4 rounded-2xl p-5 opacity-60">
              <span className="rounded-xl bg-[var(--state-neutral-bg)] p-2 text-[var(--state-neutral-fg)]">
                <AppIcon name={s.icon} />
              </span>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
                <StatusBadge tone="warning" className="mt-2 text-[10px]">
                  อยู่ระหว่างพัฒนา
                </StatusBadge>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
