import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const settingSections = [
    {
      title: "จัดการบทบาทผู้ใช้",
      desc: "Super Admin, Provincial Admin, Hospital Admin, Officer, Viewer",
      icon: "🔑",
    },
    { title: "จัดการหน่วยงาน", desc: "เพิ่ม/แก้ไขโรงพยาบาล, สสอ., รพ.สต.", icon: "🏥" },
    { title: "จัดการประเภททรัพย์สิน", desc: "Computer, Notebook, Printer, Server, Network…", icon: "🗂️" },
    { title: "จัดการสถานะทรัพย์สิน", desc: "Active, Inactive, Broken, Disposed, Lost…", icon: "🔵" },
    { title: "จัดการยี่ห้อ / รุ่น", desc: "Manufacturer catalog", icon: "🏷️" },
    { title: "ตั้งค่าปีงบประมาณ", desc: "กำหนดรอบตรวจนับ, ปีงบประมาณ", icon: "📅" },
    { title: "ตั้งค่ารหัสครุภัณฑ์", desc: "รูปแบบ prefix และการออกเลขอัตโนมัติ", icon: "🔢" },
    { title: "ตั้งค่า QR Code", desc: "รูปแบบ QR, ขนาด, โลโก้", icon: "⬡" },
    { title: "Audit Log", desc: "ดูว่าใครแก้ไขข้อมูลอะไร เมื่อไหร่", icon: "📝" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · ตั้งค่าระบบ</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ตั้งค่าระบบ</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingSections.map((s) => (
          <div key={s.title} className="glass-panel flex items-start gap-4 rounded-2xl p-5 opacity-75">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{s.desc}</p>
              <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                อยู่ระหว่างพัฒนา
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        🚧 หน้าตั้งค่าระบบอยู่ระหว่างพัฒนา สามารถจัดการผู้ใช้งานได้ที่เมนู <strong>ผู้ใช้งาน</strong>
      </div>
    </div>
  );
}
