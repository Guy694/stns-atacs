import Link from "next/link";
import { redirect } from "next/navigation";

import { ASSET_CLASS_OPTIONS } from "@/lib/asset-classes";
import { ASSET_STATUS_LABELS } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { listActiveDeviceTypes } from "@/lib/device-types";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { canAccessAssetFacility } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.9em] font-semibold text-stone-800">{children}</code>;
}

export default async function AssetImportGuidePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canViewAssets = await hasPermission(user.role, "assets.view");
  if (!canViewAssets) redirect("/dashboard");

  const [allWorkGroups, deviceTypes] = await Promise.all([listFacilityWorkGroups(), listActiveDeviceTypes()]);
  const workGroups = allWorkGroups.filter((workGroup) => canAccessAssetFacility(user, workGroup.facilityId));
  const groupedWorkGroups = workGroups.reduce<Record<string, typeof workGroups>>((groups, workGroup) => {
    (groups[workGroup.facilityName] ??= []).push(workGroup);
    return groups;
  }, {});
  const deviceTypesByCategory = deviceTypes.reduce<Record<"Hardware" | "Software", typeof deviceTypes>>((groups, deviceType) => {
    groups[deviceType.category].push(deviceType);
    return groups;
  }, { Hardware: [], Software: [] });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 pb-10">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]" aria-label="เส้นทางนำทาง">
        <Link href="/assets" className="hover:text-[var(--foreground)]">รายการทรัพย์สิน</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">คู่มือนำเข้า CSV</span>
      </nav>

      <header className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 to-emerald-800 px-6 py-8 text-white shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">ATACS · Asset Import</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">คู่มือนำเข้าครุภัณฑ์ด้วย CSV</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100 sm:text-base">ใช้หน้านี้เพื่อเตรียมไฟล์ CSV สำหรับเพิ่มหรือแก้ไขครุภัณฑ์ ตรวจสอบการใช้ <Code>id</Code> และค้นหา <Code>work_group_id</Code> ของแต่ละหน่วยบริการก่อนนำเข้า</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/api/export/assets?template=csv" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">ดาวน์โหลดไฟล์ CSV ตัวอย่าง</Link>
          <Link href="/assets" className="rounded-xl border border-emerald-200/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">กลับไปรายการทรัพย์สิน</Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="ขั้นตอนนำเข้าแบบย่อ">
        {[
          ["1", "ดาวน์โหลดและกรอกไฟล์", "ใช้ไฟล์ตัวอย่างของระบบ และคงชื่อคอลัมน์แถวแรกไว้"],
          ["2", "เลือกหน่วยบริการ", "ดู Work Group และ work_group_id ของหน่วยบริการนั้นในหน้าต่างนำเข้า"],
          ["3", "อัปโหลดและตรวจผล", "ระบบสรุปจำนวนรายการที่เพิ่มใหม่ แก้ไข และข้าม พร้อมสาเหตุ"],
        ].map(([number, title, detail]) => (
          <div key={number} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">{number}</span>
            <h2 className="mt-3 font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-sky-950">การใช้คอลัมน์ <Code>id</Code></h2>
          <p className="mt-2 text-sm leading-6 text-sky-950">ค่า <Code>id</Code> ระบุว่าแถวนั้นจะเพิ่มข้อมูลใหม่ หรือแก้ไขข้อมูลเดิม จึงต้องใช้ค่าจากระบบเท่านั้น</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-sky-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-sky-100 text-sky-950"><tr><th className="px-4 py-3 font-semibold">กรณี</th><th className="px-4 py-3 font-semibold">ค่า id</th><th className="px-4 py-3 font-semibold">ผลลัพธ์</th></tr></thead>
              <tbody className="text-slate-700">
                <tr className="border-t border-sky-100"><td className="px-4 py-3">เพิ่มรายการใหม่</td><td className="px-4 py-3">เว้นว่าง</td><td className="px-4 py-3">ระบบสร้าง id ให้อัตโนมัติ</td></tr>
                <tr className="border-t border-sky-100"><td className="px-4 py-3">แก้ไขรายการเดิม</td><td className="px-4 py-3">ใช้ id จากไฟล์ Export</td><td className="px-4 py-3">ระบบแก้ไขรายการที่ตรงกัน</td></tr>
                <tr className="border-t border-sky-100"><td className="px-4 py-3">id ไม่พบ/อยู่คนละหน่วยบริการ</td><td className="px-4 py-3">ไม่ถูกต้อง</td><td className="px-4 py-3">ระบบข้ามแถวและแจ้งเหตุผล</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 rounded-xl border border-sky-200 bg-white/70 p-3 text-sm leading-6 text-sky-950"><strong>ข้อควรระวัง:</strong> ห้ามสร้างหรือคาดเดา id เอง หากจะแก้ไขข้อมูล ให้ Export CSV ล่าสุดจากระบบก่อนเสมอ</p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-amber-950">การใช้คอลัมน์ <Code>work_group_id</Code></h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">เมื่อเลือกหน่วยบริการในหน้าต่างนำเข้า ระบบจะแสดง id ของกลุ่มงานที่ใช้ได้เฉพาะหน่วยบริการนั้น ให้คัดลอกตัวเลขดังกล่าวใส่ในทุกแถวที่เกี่ยวข้อง</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-950">
            <li className="rounded-xl border border-amber-200 bg-white/70 p-3"><strong>หน่วยบริการมีกลุ่มงาน:</strong> ระบุ <Code>work_group_id</Code> ตามตารางที่ระบบแสดง</li>
            <li className="rounded-xl border border-amber-200 bg-white/70 p-3"><strong>ไม่มีกลุ่มงานที่เปิดใช้งาน:</strong> เว้นคอลัมน์นี้ว่างได้</li>
            <li className="rounded-xl border border-amber-200 bg-white/70 p-3"><strong>ห้ามใช้ข้ามหน่วยบริการ:</strong> ระบบปฏิเสธ id ที่ไม่ใช่ของหน่วยบริการที่เลือก</li>
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Active Work Groups</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">ตาราง Work Group และ ID ตามหน่วยบริการ</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">รายการนี้แสดงเฉพาะกลุ่มงานที่เปิดใช้งานอยู่ หากต้องการกรอก CSV ให้ตรวจสอบอีกครั้งจากตารางใต้หน่วยบริการที่เลือกในหน้าต่างนำเข้า</p>
          </div>
          <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">{workGroups.length.toLocaleString("th-TH")} กลุ่มงาน</span>
        </div>

        {workGroups.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-black/15 bg-[var(--neutral-bg)] p-6 text-center text-sm text-[var(--muted)]">ยังไม่พบกลุ่มงานที่เปิดใช้งาน</div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {Object.entries(groupedWorkGroups).map(([facilityName, facilityWorkGroups]) => (
              <article key={facilityName} className="overflow-hidden rounded-xl border border-black/10">
                <h3 className="bg-stone-50 px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{facilityName}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-y border-stone-100 text-xs text-[var(--muted)]"><tr><th className="px-4 py-2 font-semibold">work_group_id</th><th className="px-4 py-2 font-semibold">ชื่อกลุ่มงาน</th></tr></thead>
                    <tbody>{facilityWorkGroups.map((workGroup) => <tr key={workGroup.id} className="border-b border-stone-100 last:border-0"><td className="px-4 py-2.5"><Code>{workGroup.id}</Code></td><td className="px-4 py-2.5 text-[var(--foreground)]">{workGroup.workGroupName}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">CSV Reference Values</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">ค่าที่ใช้กรอกในไฟล์ CSV</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">คัดลอกคำในคอลัมน์ <strong>ค่าที่กรอก</strong> ให้ตรงกับตาราง เพื่อให้ข้อมูลแสดงผลและค้นหาได้อย่างสม่ำเสมอ</p>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <article className="overflow-hidden rounded-xl border border-indigo-200">
            <div className="bg-indigo-50 px-4 py-3"><h3 className="font-semibold text-indigo-950">กลุ่มครุภัณฑ์ <Code>asset_class</Code></h3><p className="mt-1 text-xs text-indigo-900">เลือก 1 ค่าให้ตรงกับชนิดของครุภัณฑ์</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-indigo-100 text-xs text-[var(--muted)]"><tr><th className="px-4 py-2 font-semibold">ค่าที่กรอก</th><th className="px-4 py-2 font-semibold">ความหมาย</th></tr></thead><tbody>{ASSET_CLASS_OPTIONS.map((assetClass) => <tr key={assetClass.value} className="border-b border-indigo-50 last:border-0"><td className="px-4 py-2.5"><Code>{assetClass.value}</Code></td><td className="px-4 py-2.5 text-[var(--foreground)]">{assetClass.label}</td></tr>)}</tbody></table></div>
          </article>

          <article className="overflow-hidden rounded-xl border border-violet-200">
            <div className="bg-violet-50 px-4 py-3"><h3 className="font-semibold text-violet-950">ลักษณะทรัพย์สิน <Code>asset_category</Code></h3><p className="mt-1 text-xs text-violet-900">ต้องเลือกให้สอดคล้องกับประเภทอุปกรณ์</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-violet-100 text-xs text-[var(--muted)]"><tr><th className="px-4 py-2 font-semibold">ค่าที่กรอก</th><th className="px-4 py-2 font-semibold">ใช้กับ</th></tr></thead><tbody><tr className="border-b border-violet-50"><td className="px-4 py-2.5"><Code>Hardware</Code></td><td className="px-4 py-2.5 text-[var(--foreground)]">อุปกรณ์จับต้องได้ เช่น คอมพิวเตอร์ เครื่องพิมพ์ เครือข่าย</td></tr><tr><td className="px-4 py-2.5"><Code>Software</Code></td><td className="px-4 py-2.5 text-[var(--foreground)]">โปรแกรม ระบบงาน หรือสิทธิ์การใช้งาน</td></tr></tbody></table></div>
          </article>

          <article className="overflow-hidden rounded-xl border border-rose-200">
            <div className="bg-rose-50 px-4 py-3"><h3 className="font-semibold text-rose-950">สถานะ <Code>current_status</Code></h3><p className="mt-1 text-xs text-rose-900">ใช้ค่าในตารางนี้เพื่อสะท้อนสถานะปัจจุบัน</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-y border-rose-100 text-xs text-[var(--muted)]"><tr><th className="px-4 py-2 font-semibold">ค่าที่กรอก</th><th className="px-4 py-2 font-semibold">ความหมาย</th></tr></thead><tbody>{Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => <tr key={value} className="border-b border-rose-50 last:border-0"><td className="px-4 py-2.5"><Code>{value}</Code></td><td className="px-4 py-2.5 text-[var(--foreground)]">{label}</td></tr>)}</tbody></table></div>
          </article>

          <article className="overflow-hidden rounded-xl border border-emerald-200">
            <div className="bg-emerald-50 px-4 py-3"><h3 className="font-semibold text-emerald-950">ประเภททรัพย์สิน / อุปกรณ์ <Code>device_type</Code></h3><p className="mt-1 text-xs text-emerald-900">เลือกจากรายการที่ระบบเปิดใช้งานอยู่ในปัจจุบัน</p></div>
            <div className="space-y-4 p-4">
              {(["Hardware", "Software"] as const).map((category) => (
                <div key={category}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">{category}</p>
                  {deviceTypesByCategory[category].length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{deviceTypesByCategory[category].map((deviceType) => <span key={deviceType.id || deviceType.name} className="rounded-lg border border-emerald-100 bg-white px-2.5 py-1 text-xs font-medium text-emerald-950">{deviceType.name}</span>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">ยังไม่มีประเภทที่เปิดใช้งาน</p>}
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-3 text-sm leading-6 text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-3">
          <p><Code>asset_name</Code> ต้องมีทุกแถว</p>
          <p>คอมพิวเตอร์ต้องระบุ <Code>windows_license_status</Code> เป็น Genuine หรือ Pirated</p>
          <p>วันที่ใช้รูปแบบ <Code>YYYY-MM-DD</Code></p>
          <p>ระบบตรวจสอบเลขทะเบียนและ Serial Number ที่ซ้ำภายในหน่วยบริการ</p>
          <p><Code>work_group_id</Code> ต้องเป็น id ของหน่วยบริการที่เลือก</p>
        </div>
      </section>
    </div>
  );
}
