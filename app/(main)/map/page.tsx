import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · แผนที่ทรัพย์สิน</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">แผนที่ทรัพย์สิน</h1>
      </div>

      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-100 text-4xl">🗺️</div>
        <h2 className="text-xl font-semibold">แผนที่หน่วยบริการ จ.สตูล</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          แสดงตำแหน่งหน่วยบริการ และจำนวนทรัพย์สินแยกตามอำเภอ/หน่วยบริการบนแผนที่จังหวัดสตูล
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
          {["แผนที่จังหวัด", "Cluster ตามอำเภอ", "ดูข้อมูลรายหน่วย", "กรองตามประเภท"].map((f) => (
            <span key={f} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">{f}</span>
          ))}
        </div>
        <p className="mt-8 text-xs text-[var(--muted)]">🚧 ฟีเจอร์นี้อยู่ระหว่างพัฒนา (ต้องการ Google Maps API หรือ OpenStreetMap)</p>
      </div>
    </div>
  );
}
