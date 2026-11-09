import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { PageHero } from "@/app/(main)/admin/_components/page-hero";
import { getCurrentUser } from "@/lib/auth";
import { listCronStatus, type CronHealth } from "@/lib/cron-status";
import { formatThaiDateTime } from "@/lib/date-format";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { getFacilityAgentContext } from "@/lib/facility-work-groups";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

type Section = {
  title: string;
  desc: string;
  icon: IconName;
  href?: string;
  permissionKey?: PermissionKey;
};

const CRON_LABEL: Record<CronHealth, string> = { ok: "ปกติ", late: "ล่าช้า", failed: "มีปัญหา", never: "ไม่เคยรัน" };
const CRON_TONE: Record<CronHealth, "success" | "warning" | "danger" | "neutral"> = { ok: "success", late: "warning", failed: "danger", never: "danger" };

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
  if (user.role !== "admin") {
    for (const permission of ["users.manage", "permissions.manage", "device-types.manage", "audit.view"] as const) {
      permissionChecks[permissionEntries.indexOf(permission)] = false;
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
      desc: "เครื่องแม่ข่าย, เครื่องพิมพ์, สแกนเนอร์, สวิตช์เครือข่าย ... สำหรับ dropdown ในฟอร์ม",
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
      desc: "เลือกหน่วยงานแล้วคัดลอกคำสั่งติดตั้ง Agent ดูเครื่องที่รายงานเข้ามา",
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
      title: "ปิดปรับปรุงระบบ",
      desc: "แจ้งผู้ใช้ว่าระบบปิดปรับปรุง และให้เฉพาะผู้ดูแลระบบเข้าใช้งานได้ชั่วคราว",
      icon: "settings",
      href: "/admin/settings/maintenance",
      permissionKey: "permissions.manage",
    },
    {
      title: "ประกาศ / ประชาสัมพันธ์ (popup)",
      desc: "แสดงข่าว ภาพ หรือแจ้งอัปเดตเวอร์ชันหลังเข้าสู่ระบบ เปิด/ปิดได้",
      icon: "file-text",
      href: "/admin/settings/announcement",
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

  // M15: งานตั้งเวลา (cron) — แสดงเฉพาะผู้ดูแลระบบส่วนกลาง
  const isCentralAdmin = user.role === "admin" && getFacilityScopeId(user) === undefined;
  const cronJobs = isCentralAdmin ? await listCronStatus() : [];
  const cronProblem = cronJobs.some((job) => job.health !== "ok");

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
      <PageHero
        icon="settings"
        image="it-storage"
        title="ตั้งค่าระบบ"
        description="จัดการผู้ใช้งาน หน่วยงาน สิทธิ์ และการตั้งค่าทั่วไปของระบบ ATACS"
      />

      {isCentralAdmin && (
        <section aria-labelledby="cron-status-heading" className="glass-panel rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
            <h2 id="cron-status-heading" className="inline-flex items-center gap-2 text-sm font-semibold">
              <AppIcon name="history" size={16} className="text-[var(--muted)]" />
              งานตั้งเวลา (cron)
            </h2>
            {cronProblem ? (
              <span className="text-xs text-[var(--state-warning-fg)]">
                มีงานที่ไม่ได้รันตามรอบ ตรวจ CRON_SECRET และตัวเรียก cron บนเซิร์ฟเวอร์
              </span>
            ) : (
              <span className="text-xs text-[var(--muted)]">ทำงานตามรอบทุกงาน</span>
            )}
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {cronJobs.map((job) => (
              <li key={job.key} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{job.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    <code className="font-mono">/api/cron/{job.key}</code> · ควรรันทุก {job.everyMinutes >= 1440 ? "วัน" : `${job.everyMinutes} นาที`}
                    {job.run?.detail ? ` · ${job.run.detail}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs tabular-nums text-[var(--muted)]">{job.run ? formatThaiDateTime(job.run.at) : "ไม่เคยรัน"}</span>
                  <StatusBadge tone={CRON_TONE[job.health]}>{CRON_LABEL[job.health]}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowedSections.map((s) =>
          s.href ? (
            <Link
              key={s.title}
              href={s.href}
              className="glass-panel group flex items-start gap-4 rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-soft-strong)] hover:shadow-md"
            >
              <span className="rounded-xl bg-[var(--primary-soft)] p-2 text-[var(--primary-text)]">
                <AppIcon name={s.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
              </div>
              <AppIcon name="chevron-right" size={18} className="mt-0.5 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
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
