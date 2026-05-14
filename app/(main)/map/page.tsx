import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listFacilities } from "@/lib/assets";
import { MapClient } from "./_components/map-client";

const TYPE_COLOR: Record<string, string> = {
  "รพ.ทั่วไป": "#6366f1",
  "รพ.ชุมชน": "#0ea5e9",
  "รพ.สต.": "#10b981",
  "ศสช.": "#f59e0b",
  "สสจ.": "#ec4899",
  "สสอ.": "#8b5cf6",
  "สอน.": "#64748b",
};

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const facilities = await listFacilities();
  const withCoords = facilities.filter((f) => f.lat && f.lon);

  const byDistrict = withCoords.reduce<Record<string, number>>((acc, f) => {
    const d = f.district_name ?? "ไม่ระบุ";
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · แผนที่ทรัพย์สิน</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">แผนที่หน่วยบริการ จ.สตูล</h1>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_COLOR).map(([type, color]) => {
          const count = withCoords.filter((f) => f.typecode === type).length;
          if (!count) return null;
          return (
            <span key={type} className="flex items-center gap-1.5 rounded-full border px-3 py-1"
              style={{ borderColor: color + "40", background: color + "12", color }}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {type} ({count})
            </span>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* แผนที่ */}
        <div className="glass-panel overflow-hidden rounded-2xl lg:col-span-3" style={{ height: 560 }}>
          <MapClient facilities={withCoords.map((f) => ({
            id: f.id,
            name: f.name,
            typecode: f.typecode,
            district_name: f.district_name,
            lat: Number(f.lat),
            lon: Number(f.lon),
            asset_count: f.asset_count,
            has_survey: f.has_survey,
          }))} />
        </div>

        {/* สรุปรายอำเภอ */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">หน่วยบริการรายอำเภอ</p>
          <ul className="space-y-2">
            {Object.entries(byDistrict).sort().map(([district, count]) => (
              <li key={district} className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)]">{district}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{count}</span>
              </li>
            ))}
          </ul>
          <hr className="my-3" style={{ borderColor: "var(--line)" }} />
          <p className="text-xs text-[var(--muted)]">
            แสดง {withCoords.length} จาก {facilities.length} หน่วยบริการ<br />
            (เฉพาะที่มีพิกัด GPS)
          </p>
        </div>
      </div>
    </div>
  );
}

