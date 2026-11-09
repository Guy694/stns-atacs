import { redirect } from "next/navigation";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { listFacilities } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { MapClient } from "./_components/map-client";

// Legend follows the provincial order: สสจ. → สสอ. → รพ.ทั่วไป → รพ.ชุมชน → รพ.สต. → สอน. → ศสช.
const TYPE_COLOR: Record<string, string> = {
  "สสจ.": "#0f766e",
  "สสอ.": "#64748b",
  "รพ.ทั่วไป": "#14532d",
  "รพ.ชุมชน": "#2563eb",
  "รพ.สต.": "#059669",
  "สอน.": "#475569",
  "ศสช.": "#b45309",
};

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");
  const facilities = await listFacilities({ facilityId: facilityScopeId });
  const withCoords = facilities.filter((f) => f.lat && f.lon);

  const byDistrict = withCoords.reduce<Record<string, number>>((acc, f) => {
    const d = f.district_name ?? "ไม่ระบุ";
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <header className="relative isolate overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 lg:p-6">
        <PhotoBackdrop image="meeting-room" opacity="opacity-[0.12]" fade="left" />
        <h1 className="section-title text-2xl font-semibold sm:text-3xl">แผนที่หน่วยบริการ จ.สตูล</h1>
        <p className="mt-1 text-sm text-[var(--neutral-text)]">ตำแหน่งหน่วยบริการและจำนวนทรัพย์สินที่บันทึกในทะเบียน</p>
      </header>

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
          <p className="mb-3 text-xs font-semibold text-[var(--muted)]">หน่วยบริการรายอำเภอ</p>
          <ul className="space-y-2">
            {Object.entries(byDistrict).sort().map(([district, count]) => (
              <li key={district} className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)]">{district}</span>
                <StatusBadge tone="primary">{count}</StatusBadge>
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
